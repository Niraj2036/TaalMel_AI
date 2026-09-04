import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

export function extractBaseGroup(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const parts = ref.split('-');
  if (parts.length >= 3) {
    return parts.slice(0, parts.length - 1).join('-');
  }
  return ref;
}

function findRemaining10() {
  const bankPath = path.join(__dirname, '../data/dataset3/nightmare_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset3/nightmare_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset3/nightmare_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  const gatewayTxns = rawGW.map((raw: any) => {
    const norm = normalizeGateway(raw);
    const batchRef = raw.merchant_ref || raw.settlement_batch;
    norm.settlementId = extractBaseGroup(batchRef) || norm.settlementId;
    return norm;
  });

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-nightmare-10');

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const unmatchedBank = bankTxns.filter(b => !matchedBankTxnIds.has(b.id));

  console.log(`Unmatched Bank Records (${unmatchedBank.length}):`);
  unmatchedBank.forEach(b => {
    console.log(`ID: ${b.sourceTxnId}, Date: ${b.date.slice(0, 10)}, Amount: ₹${(b.amount / 100).toFixed(2)}, Desc: ${b.description}`);
  });
}

findRemaining10();
