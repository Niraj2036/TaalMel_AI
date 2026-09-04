import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

async function testAll3Datasets() {
  console.log('====================================================');
  console.log('    TESTING ENGINE ACROSS ALL 3 DATASETS           ');
  console.log('====================================================\n');

  // --- DATASET 1 (data/new/) ---
  {
    const bankPath = path.join(__dirname, '../data/new/bank_statement_100_cases.csv');
    const erpPath = path.join(__dirname, '../data/new/erp_ledger_100_cases.csv');
    const gwPath = path.join(__dirname, '../data/new/payment_gateway_100_cases.csv');

    const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

    const bankTxns = rawBank.map(normalizeBank);
    const erpTxns = rawERP.map(normalizeERP);
    const gatewayTxns = rawGW.map(normalizeGateway);

    const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-ds1');
    const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));

    console.log('--- DATASET 1 (data/new/) ---');
    console.log(`Bank Records Total: ${bankTxns.length}`);
    console.log(`Matched Bank Credits: ${matchedBankIds.size} / 135 (Expected: 132 / 135 = 97.78%)`);
    console.log(`Match Rate: ${((matchedBankIds.size / bankTxns.length) * 100).toFixed(2)}%`);
    console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankIds.size} (Expected: 3)\n`);
  }

  // --- DATASET 2 (data/dataset2/) ---
  {
    const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
    const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
    const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

    const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

    const bankTxns = rawBank.map(normalizeBank);
    const erpTxns = rawERP.map(normalizeERP);
    const gatewayTxns = rawGW.map(normalizeGateway);

    const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-ds2');
    const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));

    console.log('--- DATASET 2 (data/dataset2/) ---');
    console.log(`Bank Records Total: ${bankTxns.length}`);
    console.log(`Matched Bank Credits: ${matchedBankIds.size} / 287 (Expected: 263 / 287 = 91.64%)`);
    console.log(`Match Rate: ${((matchedBankIds.size / bankTxns.length) * 100).toFixed(2)}%`);
    console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankIds.size} (Expected: 24)\n`);
  }

  // --- DATASET 3 (data/dataset3/ Nightmare) ---
  {
    const bankPath = path.join(__dirname, '../data/dataset3/nightmare_bank_statement.csv');
    const erpPath = path.join(__dirname, '../data/dataset3/nightmare_erp_ledger.csv');
    const gwPath = path.join(__dirname, '../data/dataset3/nightmare_payment_gateway.csv');

    const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
    const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

    const bankTxns = rawBank.map(normalizeBank);
    const erpTxns = rawERP.map(normalizeERP);
    const gatewayTxns = rawGW.map(normalizeGateway);

    const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-ds3');
    const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));

    console.log('--- DATASET 3 (data/dataset3/ Nightmare) ---');
    console.log(`Bank Records Total: ${bankTxns.length}`);
    console.log(`Matched Bank Credits: ${matchedBankIds.size} / 441 (Expected: 411 / 441 = 93.20%)`);
    console.log(`Match Rate: ${((matchedBankIds.size / bankTxns.length) * 100).toFixed(2)}%`);
    console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankIds.size} (Expected: 30)\n`);
  }
}

testAll3Datasets().catch(console.error);
