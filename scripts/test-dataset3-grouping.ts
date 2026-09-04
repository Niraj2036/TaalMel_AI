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

function testDataset3Fix() {
  const bankPath = path.join(__dirname, '../data/dataset3/nightmare_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset3/nightmare_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset3/nightmare_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  // Normalize Gateway with universal extractBaseGroup
  const gatewayTxns = rawGW.map((raw: any) => {
    const norm = normalizeGateway(raw);
    const batchRef = raw.merchant_ref || raw.settlement_batch;
    norm.settlementId = extractBaseGroup(batchRef) || norm.settlementId;
    return norm;
  });

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-nightmare-fix');

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const matchedCount = matchedBankTxnIds.size;
  const totalBank = bankTxns.length;

  console.log('\n====================================================');
  console.log('       DATASET 3 RESULTS AFTER UNIVERSAL GROUPING  ');
  console.log('====================================================');
  console.log(`Bank Records Total: ${totalBank}`);
  console.log(`Matched Bank Credits: ${matchedCount} / ${totalBank}`);
  console.log(`Match Rate: ${((matchedCount / totalBank) * 100).toFixed(2)}% (Expected: 411 / 441 = 93.20%)`);
  console.log(`Unmatched Bank Credits: ${totalBank - matchedCount} (Expected: 30)`);
}

testDataset3Fix();
