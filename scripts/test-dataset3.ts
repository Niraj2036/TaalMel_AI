import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

async function analyzeDataset3() {
  console.log('====================================================');
  console.log('       ANALYZING NIGHTMARE DATASET (DATASET 3)      ');
  console.log('====================================================\n');

  const bankPath = path.join(__dirname, '../data/dataset3/nightmare_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset3/nightmare_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset3/nightmare_payment_gateway.csv');

  const bankText = fs.readFileSync(bankPath, 'utf8');
  const erpText = fs.readFileSync(erpPath, 'utf8');
  const gwText = fs.readFileSync(gwPath, 'utf8');

  const rawBank = Papa.parse(bankText, { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(erpText, { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(gwText, { header: true, skipEmptyLines: true }).data as any[];

  console.log(`Raw Bank rows: ${rawBank.length}`);
  console.log(`Raw ERP rows: ${rawERP.length}`);
  console.log(`Raw Gateway rows: ${rawGW.length}`);
  console.log(`Total raw CSV rows: ${rawBank.length + rawERP.length + rawGW.length}\n`);

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGW.map(normalizeGateway);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-nightmare');

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  console.log('--- CURRENT ENGINE RESULT ---');
  console.log(`Matched Bank Credits: ${matchedBankTxnIds.size} / ${bankTxns.length}`);
  console.log(`Match Rate: ${((matchedBankTxnIds.size / bankTxns.length) * 100).toFixed(2)}%`);
  console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankTxnIds.size} (Expected: 30, Currently: ${bankTxns.length - matchedBankTxnIds.size})\n`);

  // Analyze unmatched bank records
  const unmatchedBank = bankTxns.filter(b => !matchedBankTxnIds.has(b.id));

  console.log('--- SAMPLE UNMATCHED BANK RECORDS (First 20) ---');
  unmatchedBank.slice(0, 20).forEach(b => {
    console.log(`ID: ${b.sourceTxnId}, Date: ${b.date.slice(0, 10)}, Amount: ₹${(b.amount / 100).toFixed(2)}, Desc: ${b.description}`);
  });
}

analyzeDataset3().catch(console.error);
