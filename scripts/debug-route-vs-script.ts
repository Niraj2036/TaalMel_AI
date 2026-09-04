import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway, hasGoodHeuristicConfidence, inferSchemaFromLLM, normalizeWithSchema } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

async function debugDifference() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  console.log('--- Checking hasGoodHeuristicConfidence ---');
  console.log('Bank[0] confidence:', hasGoodHeuristicConfidence(rawBank[0]));
  console.log('ERP[0] confidence:', hasGoodHeuristicConfidence(rawERP[0]));
  console.log('Gateway[0] confidence:', hasGoodHeuristicConfidence(rawGW[0]));

  // Test 1: Calling heuristic normalizers directly
  const bank1 = rawBank.map(normalizeBank);
  const erp1 = rawERP.map(normalizeERP);
  const gw1 = rawGW.map(normalizeGateway);
  const res1 = reconcile(erp1, bank1, gw1, 'test-1');
  const matchedBank1 = new Set(res1.matches.flatMap(m => m.bankTxnIds)).size;

  console.log(`\nTest 1 (Direct Heuristic mapping): Matched Bank Credits = ${matchedBank1} / ${bank1.length} (${(matchedBank1/bank1.length*100).toFixed(2)}%)`);

  // Test 2: Simulating normalizeRows from app/api/reconcile/route.ts
  async function normalizeRows(rows: any[], sourceType: 'BANK' | 'ERP' | 'GATEWAY', heuristicFn: (r: any) => any) {
    if (rows.length === 0) return [];
    const needsLLM = !hasGoodHeuristicConfidence(rows[0]);
    if (!needsLLM) {
      return rows.map(r => heuristicFn(r));
    }
    const headers = Object.keys(rows[0]);
    const schema = await inferSchemaFromLLM(headers, rows.slice(0, 2));
    if (!schema.date && !schema.amount && !schema.credit) {
      return rows.map(r => heuristicFn(r));
    }
    return rows.map(r => normalizeWithSchema(r, schema, sourceType));
  }

  const bank2 = await normalizeRows(rawBank, 'BANK', normalizeBank);
  const erp2 = await normalizeRows(rawERP, 'ERP', normalizeERP);
  const gw2 = await normalizeRows(rawGW, 'GATEWAY', normalizeGateway);
  const res2 = reconcile(erp2, bank2, gw2, 'test-2');
  const matchedBank2 = new Set(res2.matches.flatMap(m => m.bankTxnIds)).size;

  console.log(`Test 2 (normalizeRows wrapper): Matched Bank Credits = ${matchedBank2} / ${bank2.length} (${(matchedBank2/bank2.length*100).toFixed(2)}%)`);
}

debugDifference().catch(console.error);
