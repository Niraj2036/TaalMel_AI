import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

function inspectCases() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  console.log('--- GW merchant_ref patterns ---');
  const refs = new Set(rawGW.map((g: any) => g.merchant_ref));
  console.log('Sample refs:', Array.from(refs).slice(0, 30));

  // Extract base case group ID from merchant_ref (e.g. "BULK-52-1" -> "BULK-52", "NM-91-0" -> "NM-91")
  const baseGroups = new Map<string, any[]>();
  for (const g of rawGW) {
    const ref = g.merchant_ref || '';
    // e.g. BULK-52-1 -> BULK-52
    const parts = ref.split('-');
    let groupKey = ref;
    if (parts.length >= 3) {
      groupKey = `${parts[0]}-${parts[1]}`;
    }
    const arr = baseGroups.get(groupKey) || [];
    arr.push(g);
    baseGroups.set(groupKey, arr);
  }

  console.log('\n--- Group sums vs Bank ---');
  for (const [groupKey, group] of baseGroups.entries()) {
    const totalNet = group.reduce((sum, g) => sum + parseFloat(g.net_settlement || '0'), 0);
    const totalGross = group.reduce((sum, g) => sum + parseFloat(g.gross_amount || '0'), 0);

    // Search bank for net match or gross match or subset match
    const bankMatchesNet = rawBank.filter((b: any) => Math.abs(parseFloat(b.amount) - totalNet) < 0.05);
    const bankMatchesGross = rawBank.filter((b: any) => Math.abs(parseFloat(b.amount) - totalGross) < 0.05);

    if (bankMatchesNet.length > 0) {
      console.log(`[NET MATCH] Group ${groupKey} (${group.length} GWs): Net=${totalNet} -> Bank ${bankMatchesNet[0].bank_txn_id} (${bankMatchesNet[0].amount})`);
    } else if (bankMatchesGross.length > 0) {
      console.log(`[GROSS MATCH] Group ${groupKey} (${group.length} GWs): Gross=${totalGross} -> Bank ${bankMatchesGross[0].bank_txn_id} (${bankMatchesGross[0].amount})`);
    } else {
      console.log(`[NO MATCH] Group ${groupKey} (${group.length} GWs): Net=${totalNet}, Gross=${totalGross}`);
    }
  }
}

inspectCases();
