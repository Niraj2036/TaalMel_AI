import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

function inspectSplitAndNM() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  console.log('--- SPLIT-66 analysis ---');
  const gwSplit66 = rawGW.filter((g: any) => g.merchant_ref.includes('SPLIT-66'));
  console.log('GW SPLIT-66 records:', gwSplit66);

  const bankSplit66 = rawBank.filter((b: any) => b.description.includes('SPLIT-66') || b.description.includes('PAY66'));
  console.log('Bank records mentioning SPLIT-66 / PAY66:', bankSplit66);

  // Print all bank entries from line 66 to line 90
  const bankSplits = rawBank.filter((b: any) => b.description.includes('SPLIT') || b.description.includes('PARTIAL') || b.description.includes('TRANCH'));
  console.log(`\nBank entries mentioning SPLIT/PARTIAL/TRANCHE: ${bankSplits.length}`);
  console.log('Sample Bank SPLIT entries (first 10):', bankSplits.slice(0, 10));

  console.log('\n--- NM-91 analysis ---');
  const gwNM91 = rawGW.filter((g: any) => g.merchant_ref.includes('NM-91'));
  console.log('GW NM-91 records:', gwNM91);
  const bankNM91 = rawBank.filter((b: any) => b.description.includes('NM-91') || b.description.includes('PAY91'));
  console.log('Bank records mentioning NM-91:', bankNM91);
}

inspectSplitAndNM();
