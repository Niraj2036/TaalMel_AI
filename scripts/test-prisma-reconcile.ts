import fs from 'fs';
import path from 'path';
import prisma from '../lib/db';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';
import crypto from 'crypto';

async function testFullRouteDBPipeline() {
  console.log('--- TESTING FULL DB PIPELINE AGAINST NEON ---');

  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const bankText = fs.readFileSync(bankPath, 'utf8');
  const erpText = fs.readFileSync(erpPath, 'utf8');
  const gatewayText = fs.readFileSync(gwPath, 'utf8');

  const rawBank = Papa.parse(bankText, { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(erpText, { header: true, skipEmptyLines: true }).data as any[];
  const rawGateway = Papa.parse(gatewayText, { header: true, skipEmptyLines: true }).data as any[];

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGateway.map(normalizeGateway);

  const batchHash = crypto.createHash('sha256').update(bankText + erpText + gatewayText).digest('hex');
  const idempotencyKey = `${batchHash}-${Date.now()}`;

  const run = await prisma.reconciliationRun.create({
    data: { idempotencyKey, batchHash, status: 'PROCESSING' },
  });

  console.log(`Created Run ID: ${run.id}`);

  // Create transactions in DB
  await prisma.transaction.createMany({
    data: [
      ...bankTxns.map(t => ({
        runId: run.id,
        source: 'BANK' as const,
        txnId: t.sourceTxnId,
        referenceId: t.referenceId ?? null,
        utr: t.utr ?? null,
        settlementId: t.settlementId ?? null,
        amount: t.amount,
        currency: t.currency,
        txnDate: new Date(t.date),
        feeAmount: t.fee,
        taxAmount: t.tax,
        txnType: t.type,
        narration: t.description,
        rawData: JSON.stringify(t.metadata),
      })),
      ...erpTxns.map(t => ({
        runId: run.id,
        source: 'ERP' as const,
        txnId: t.sourceTxnId,
        referenceId: t.referenceId ?? null,
        utr: t.utr ?? null,
        settlementId: t.settlementId ?? null,
        amount: t.amount,
        currency: t.currency,
        txnDate: new Date(t.date),
        feeAmount: t.fee,
        taxAmount: t.tax,
        txnType: t.type,
        narration: t.description,
        rawData: JSON.stringify(t.metadata),
      })),
      ...gatewayTxns.map(t => ({
        runId: run.id,
        source: 'GATEWAY' as const,
        txnId: t.sourceTxnId,
        referenceId: t.referenceId ?? null,
        utr: t.utr ?? null,
        settlementId: t.settlementId ?? null,
        amount: t.amount,
        currency: t.currency,
        txnDate: new Date(t.date),
        feeAmount: t.fee,
        taxAmount: t.tax,
        txnType: t.type,
        narration: t.description,
        rawData: JSON.stringify(t.metadata),
      })),
    ],
    skipDuplicates: true,
  });

  const dbTxns = await prisma.transaction.findMany({
    where: { runId: run.id },
    select: { id: true, txnId: true, source: true },
  });

  console.log(`Transactions saved in DB: ${dbTxns.length} / ${bankTxns.length + erpTxns.length + gatewayTxns.length}`);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, run.id);

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const matchedCount = matchedBankTxnIds.size;
  const totalBank = bankTxns.length;
  const matchRate = (matchedCount / totalBank) * 100;

  console.log(`Matched Bank Credits: ${matchedCount} / ${totalBank}`);
  console.log(`Match Rate: ${matchRate.toFixed(2)}%`);

  await prisma.reconciliationRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      totalRecords: bankTxns.length + erpTxns.length + gatewayTxns.length,
      matchedRecords: matchedCount,
      exceptionCount: result.exceptions.length,
      matchRate,
    },
  });

  const finalRun = await prisma.reconciliationRun.findUnique({ where: { id: run.id } });
  console.log('Final DB Run Record matchRate:', finalRun?.matchRate);
}

testFullRouteDBPipeline().catch(console.error);
