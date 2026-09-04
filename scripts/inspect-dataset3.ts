import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

function inspectDataset3() {
  const bankPath = path.join(__dirname, '../data/dataset3/nightmare_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset3/nightmare_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset3/nightmare_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  console.log(`Bank: ${rawBank.length}, ERP: ${rawERP.length}, GW: ${rawGW.length}`);

  console.log('\n--- Gateway headers ---', Object.keys(rawGW[0] || {}));
  console.log('--- Gateway sample ---', rawGW.slice(0, 3));

  const gwRefs = new Set(rawGW.map((g: any) => g.merchant_ref));
  console.log(`\nUnique merchant_refs in Gateway: ${gwRefs.size}`);
  console.log('Sample merchant_ref prefixes:', Array.from(gwRefs).slice(0, 30));

  // Extract base case group ID from merchant_ref
  const baseGroups = new Map<string, any[]>();
  for (const g of rawGW) {
    const ref = g.merchant_ref || '';
    const parts = ref.split('-');
    let groupKey = ref;
    if (parts.length >= 3) {
      groupKey = `${parts[0]}-${parts[1]}`;
    }
    const arr = baseGroups.get(groupKey) || [];
    arr.push(g);
    baseGroups.set(groupKey, arr);
  }

  console.log('\n--- Group sums vs Bank (Dataset 3) ---');
  let netMatches = 0;
  let grossMatches = 0;
  let noMatches = 0;

  for (const [groupKey, group] of baseGroups.entries()) {
    const totalNet = group.reduce((sum, g) => sum + parseFloat(g.net_settlement || '0'), 0);
    const totalGross = group.reduce((sum, g) => sum + parseFloat(g.gross_amount || '0'), 0);

    const bankMatchesNet = rawBank.filter((b: any) => Math.abs(parseFloat(b.amount) - totalNet) < 0.50);
    const bankMatchesGross = rawBank.filter((b: any) => Math.abs(parseFloat(b.amount) - totalGross) < 0.50);

    if (bankMatchesNet.length > 0) {
      netMatches++;
    } else if (bankMatchesGross.length > 0) {
      grossMatches++;
    } else {
      noMatches++;
      console.log(`[NO DIRECT MATCH] Group ${groupKey} (${group.length} GWs): Net=${totalNet.toFixed(2)}, Gross=${totalGross.toFixed(2)}`);
    }
  }

  console.log(`\nDirect Net Matches: ${netMatches}, Gross Matches: ${grossMatches}, Unmatched Groups: ${noMatches}`);
}

inspectDataset3();
