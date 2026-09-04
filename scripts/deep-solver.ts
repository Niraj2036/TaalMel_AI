import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { solveSubsetSum } from '../lib/reconciliation/pass3-solver';

function analyzeAllCases() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  console.log(`Bank: ${rawBank.length}, ERP: ${rawERP.length}, GW: ${rawGW.length}`);

  // Group raw GW by merchant_ref family or customer
  // Look at SPLIT cases (SPLIT-66 to SPLIT-90)
  console.log('\n--- Analyzing SPLIT cases (SPLIT-66 to SPLIT-90) ---');
  for (let i = 66; i <= 90; i++) {
    const gwMatches = rawGW.filter((g: any) => g.merchant_ref.startsWith(`SPLIT-${i}`));
    const erpMatches = rawERP.filter((e: any) => e.invoice_id.startsWith(`E00${i}`) || e.invoice_id.startsWith(`E0${i}`) || e.invoice_id.startsWith(`E${i}`));
    
    if (gwMatches.length > 0) {
      const gwNetSum = gwMatches.reduce((s: number, g: any) => s + Math.round(parseFloat(g.net_settlement) * 100), 0);
      
      // Find subset of bank entries that sum to gwNetSum
      const bankItems = rawBank.map((b: any) => ({ id: b.bank_txn_id, amount: Math.round(parseFloat(b.amount) * 100), date: b.date }));
      const solution = solveSubsetSum(gwNetSum, bankItems, 10, 5); // 5 paise tolerance
      
      if (solution) {
        console.log(`SPLIT-${i} (Net: ₹${(gwNetSum/100).toFixed(2)}) -> Matched ${solution.length} Bank entries: [${solution.join(', ')}]`);
      } else {
        console.log(`SPLIT-${i} (Net: ₹${(gwNetSum/100).toFixed(2)}) -> NO BANK SUBSET FOUND!`);
      }
    }
  }

  console.log('\n--- Analyzing NM cases (NM-91 to NM-110) ---');
  for (let i = 91; i <= 110; i++) {
    const gwMatches = rawGW.filter((g: any) => g.merchant_ref.startsWith(`NM-${i}`));
    if (gwMatches.length > 0) {
      const gwNetSum = gwMatches.reduce((s: number, g: any) => s + Math.round(parseFloat(g.net_settlement) * 100), 0);
      const bankItems = rawBank.map((b: any) => ({ id: b.bank_txn_id, amount: Math.round(parseFloat(b.amount) * 100), date: b.date }));
      
      // Try subset sum on bank for total net sum
      const solution = solveSubsetSum(gwNetSum, bankItems, 10, 5);
      if (solution) {
        console.log(`NM-${i} (Total Net: ₹${(gwNetSum/100).toFixed(2)}, GW count: ${gwMatches.length}) -> Matched ${solution.length} Bank entries: [${solution.join(', ')}]`);
      } else {
        console.log(`NM-${i} (Total Net: ₹${(gwNetSum/100).toFixed(2)}, GW count: ${gwMatches.length}) -> NO BANK SUBSET FOUND!`);
      }
    }
  }
}

analyzeAllCases();
