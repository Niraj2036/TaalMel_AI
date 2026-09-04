import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

async function runTest() {
  console.log('=== DRY RUN: Dataset 2 Analysis ===\n');

  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const bankText = fs.readFileSync(bankPath, 'utf8');
  const erpText = fs.readFileSync(erpPath, 'utf8');
  const gwText = fs.readFileSync(gwPath, 'utf8');

  const rawBank = Papa.parse(bankText, { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(erpText, { header: true, skipEmptyLines: true }).data as any[];
  const rawGateway = Papa.parse(gwText, { header: true, skipEmptyLines: true }).data as any[];

  console.log(`Raw Bank rows: ${rawBank.length}`);
  console.log(`Raw ERP rows: ${rawERP.length}`);
  console.log(`Raw Gateway rows: ${rawGateway.length}`);
  console.log(`Total raw CSV rows: ${rawBank.length + rawERP.length + rawGateway.length}\n`);

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGateway.map(normalizeGateway);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-dataset-2');

  console.log('--- RECONCILIATION RESULT ---');
  console.log(`Matches count (Pass 1-4 match objects): ${result.matches.length}`);

  const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  console.log(`Matched Bank Credits (unique): ${matchedBankIds.size} / ${bankTxns.length}`);
  console.log(`Match Rate: ${((matchedBankIds.size / bankTxns.length) * 100).toFixed(2)}%`);
  console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankIds.size}`);
  console.log(`Total Exceptions: ${result.exceptions.length}`);

  // Breakdown of match types
  const matchTypes: Record<string, number> = {};
  for (const m of result.matches) {
    matchTypes[m.matchType] = (matchTypes[m.matchType] || 0) + 1;
  }
  console.log('\nMatch Type breakdown:', matchTypes);

  // Breakdown of exceptions by type
  const excTypes: Record<string, number> = {};
  for (const e of result.exceptions) {
    excTypes[e.type] = (excTypes[e.type] || 0) + 1;
  }
  console.log('Exception Type breakdown:', excTypes);

  // Unmatched bank credits analysis
  const unmatchedBankTxns = bankTxns.filter(b => !matchedBankIds.has(b.id));
  console.log('\nSample Unmatched Bank Credits (first 10):');
  unmatchedBankTxns.slice(0, 10).forEach(b => {
    console.log(`  Bank ID: ${b.sourceTxnId}, Date: ${b.date}, Amount: ₹${(b.amount / 100).toFixed(2)}, Desc: ${b.description}`);
  });
}

runTest().catch(console.error);
