import * as fs from 'fs';
import * as path from 'path';

// This is a simple seed file that can read the CSV files if needed.
// You can expand this to insert data into a database.

const dataDir = path.join(__dirname, '../data');

function readCSV(filename: string) {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // Basic CSV parsing, doesn't handle commas inside quotes perfectly
    // but works for our simple deterministic data
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const obj: any = {};
    headers.forEach((h, i) => {
      let val: any = values[i] ? values[i].replace(/^"|"$/g, '') : '';
      if (!isNaN(Number(val)) && val !== '') {
        val = Number(val);
      }
      obj[h] = val;
    });
    return obj;
  });
}

function runSeed() {
  console.log('Reading CSV files...');
  
  const erpData = readCSV('erp_ledger.csv');
  const gatewayData = readCSV('gateway_data.csv');
  const bankData = readCSV('bank_statement.csv');
  
  console.log(`Loaded ${erpData.length} ERP records.`);
  console.log(`Loaded ${gatewayData.length} Gateway records.`);
  console.log(`Loaded ${bankData.length} Bank records.`);
  
  // Here you could add logic to push to Prisma or another DB
  console.log('Seed completed successfully (Dry Run).');
}

runSeed();
