import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';
import { extractBaseGroup } from '../lib/normalization';

function test45Days() {
  process.env.MAX_DATE_LAG_DAYS = '45';

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

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, 'test-nightmare-45');

  const matchedBankTxnIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const matchedCount = matchedBankTxnIds.size;
  const totalBank = bankTxns.length;

  console.log('\n====================================================');
  console.log('  NIGHTMARE DATASET (DATASET 3) RESULTS (45d Lag)   ');
  console.log('====================================================');
  console.log(`Bank Records Total: ${totalBank}`);
  console.log(`Matched Bank Credits: ${matchedCount} / ${totalBank}`);
  console.log(`Match Rate: ${((matchedCount / totalBank) * 100).toFixed(2)}% (Expected: 411 / 441 = 93.20%)`);
  console.log(`Unmatched Bank Credits: ${totalBank - matchedCount} (Expected: 30)`);
}

test45Days();
