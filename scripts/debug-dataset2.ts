import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';

function debugDataset2() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGateway = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  const bank = rawBank.map(normalizeBank);
  const erp = rawERP.map(normalizeERP);
  const gw = rawGateway.map(normalizeGateway);

  console.log('=== Gateway headers ===', Object.keys(rawGateway[0] || {}));
  console.log('=== Gateway sample ===', rawGateway.slice(0, 5));

  console.log('\n=== ERP headers ===', Object.keys(rawERP[0] || {}));
  console.log('=== ERP sample ===', rawERP.slice(0, 3));

  // Search for UTR70000006, UTR70000019, UTR70000036 (BULK RECEIPT) in Gateway & ERP
  console.log('\n--- Case Analysis 1: UTR70000006 (Amount: 12034.00, Date: 2026-07-09, Customer_43) ---');
  console.log('Bank record:', bank.find(b => b.sourceTxnId === 'UTR70000006' || b.referenceId === 'UTR70000006'));
  console.log('Gateway records matching Customer_43:', gw.filter(g => (g.description || '').includes('Customer_43') || JSON.stringify(g.metadata).includes('Customer_43')));
  console.log('Gateway records with amount ~12034:', gw.filter(g => Math.abs(g.amount - 1203400) < 50000 || Math.abs(g.amount + g.fee + g.tax - 1203400) < 50000));

  console.log('\n--- Case Analysis 2: BULK RECEIPT UTR70000036 (Amount: 27605.00, Date: 2026-07-13) ---');
  const b36 = bank.find(b => b.description.includes('UTR70000036') || b.sourceTxnId.includes('0036'));
  console.log('Bank record B0036:', b36);
  // Search for any gateway or ERP records around 2026-07-13
  const gwAround = gw.filter(g => Math.abs(new Date(g.date).getTime() - new Date('2026-07-13').getTime()) <= 10 * 86400000);
  console.log(`Gateway records around 2026-07-13: ${gwAround.length}`);
  
  // Check if there are gateway records with settlementId or merchant_ref or batch
  const gwBatches = new Set(gw.map(g => g.settlementId).filter(Boolean));
  console.log(`Unique Gateway settlementId count: ${gwBatches.size}`);
  console.log('Sample Gateway settlementId values:', Array.from(gwBatches).slice(0, 10));

  // Let's check settlement net sums for these batches vs bank credits!
  const batchSums = new Map<string, number>();
  for (const g of gw) {
    if (g.settlementId) {
      batchSums.set(g.settlementId, (batchSums.get(g.settlementId) || 0) + g.amount);
    }
  }

  console.log('\nChecking batch sums vs Bank amounts:');
  let matchedBatches = 0;
  for (const [batchId, netSum] of batchSums.entries()) {
    const matchingBank = bank.filter(b => Math.abs(b.amount - netSum) <= 100);
    if (matchingBank.length > 0) {
      matchedBatches++;
    } else {
      console.log(`  Unmatched Batch ${batchId}: NetSum = ₹${(netSum / 100).toFixed(2)}, GW count = ${gw.filter(g => g.settlementId === batchId).length}`);
    }
  }
  console.log(`Matched gateway batches: ${matchedBatches} / ${batchSums.size}`);
}

debugDataset2();
