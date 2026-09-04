import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

async function testReconcileRouteLogic() {
  console.log('--- TESTING EXACT RECONCILE ROUTE PIPELINE ON DATASET 2 ---');

  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  const bankTxns = rawBank.map(r => normalizeBank(r));
  const erpTxns = rawERP.map(r => normalizeERP(r));
  const gatewayTxns = rawGW.map(r => normalizeGateway(r));

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'route-test');

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const matchedCount = matchedBankTxnIds.size;
  const exceptionCount = result.exceptions.length;
  const totalBank = bankTxns.length;
  const totalRecords = bankTxns.length + erpTxns.length + gatewayTxns.length;
  const matchRate = (matchedCount / totalBank) * 100;
  const reviewRate = ((totalBank - matchedCount) / totalBank) * 100;

  console.log(`Total Records (All 3 CSVs): ${totalRecords}`);
  console.log(`Bank Records Total: ${totalBank}`);
  console.log(`Matched Bank Credits: ${matchedCount}`);
  console.log(`Unmatched Bank Credits: ${totalBank - matchedCount}`);
  console.log(`Bank Match Rate: ${matchRate.toFixed(2)}%`);
  console.log(`Review Rate: ${reviewRate.toFixed(2)}%`);
  console.log(`Total Exceptions Flagged: ${exceptionCount}`);
}

testReconcileRouteLogic();
