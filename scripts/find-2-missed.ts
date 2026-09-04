import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

function find2Missed() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGW.map(normalizeGateway);

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-2');
  const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));

  const unmatchedBank = bankTxns.filter(b => !matchedBankIds.has(b.id));

  console.log(`Unmatched Bank Records (${unmatchedBank.length}):`);
  unmatchedBank.forEach(b => {
    console.log(`  ID: ${b.sourceTxnId}, Date: ${b.date}, Amount: ₹${(b.amount / 100).toFixed(2)}, Desc: ${b.description}`);
  });
}

find2Missed();
