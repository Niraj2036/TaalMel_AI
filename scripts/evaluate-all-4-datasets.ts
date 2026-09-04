import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway, extractBaseGroup } from '../lib/normalization';
import { reconcile } from '../lib/reconciliation/engine';

interface EvaluationResult {
  datasetName: string;
  totalRecordsProcessed: number;
  totalBankRecords: number;
  expectedMatchedBank: number;
  actualMatchedBank: number;
  expectedUnmatchedBank: number;
  actualUnmatchedBank: number;
  totalGroups: number;
  correctlyMatchedGroups: number;
  incorrectlyMatchedGroups: number;
  cardinality1to1: number;
  cardinality1toN: number;
  cardinalityNto1: number;
  cardinalityNtoM: number;
  matchRate: number;
  expectedMatchRate: number;
  precision: number;
  recall: number;
  falseAutomationRate: number;
  reviewRate: number;
  totalExceptions: number;
  caseCount: number;
  casesMatchedCorrectly: number;
}

function evaluateDataset(
  datasetName: string,
  folderName: string,
  gtFileName: string
): EvaluationResult {
  const dataDir = path.join(__dirname, '../data', folderName);
  const gtPath = path.join(__dirname, '../data/ground_truth', gtFileName);

  const bankText = fs.readFileSync(path.join(dataDir, 'bank_statement.csv'), 'utf8');
  const erpText = fs.readFileSync(path.join(dataDir, 'erp_ledger.csv'), 'utf8');
  const gwText = fs.readFileSync(path.join(dataDir, 'payment_gateway.csv'), 'utf8');
  const gtText = fs.readFileSync(gtPath, 'utf8');

  const rawBank = Papa.parse(bankText, { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(erpText, { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(gwText, { header: true, skipEmptyLines: true }).data as any[];
  const rawGT = Papa.parse(gtText, { header: true, skipEmptyLines: true }).data as any[];

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGW.map((raw: any) => {
    const norm = normalizeGateway(raw);
    const batchRef = raw.merchant_ref || raw.settlement_batch;
    norm.settlementId = extractBaseGroup(batchRef) || norm.settlementId;
    return norm;
  });

  const result = reconcile(erpTxns, bankTxns, gatewayTxns, `eval-${folderName}`);

  const matchedBankIds = new Set(result.matches.flatMap(m => m.bankTxnIds));
  const actualMatchedBank = matchedBankIds.size;
  const totalBankRecords = bankTxns.length;
  const actualUnmatchedBank = totalBankRecords - actualMatchedBank;

  // Evaluate against Ground Truth CSV
  let expectedMatchedBank = 0;
  let expectedUnmatchedBank = 0;
  let casesMatchedCorrectly = 0;

  // Build ground truth map of bank transaction ID -> expected status (MATCHED vs UNMATCHED)
  const gtBankMap = new Map<string, boolean>();
  for (const caseRow of rawGT) {
    const isMatched = (caseRow.expected_status || '').toUpperCase() === 'MATCHED';
    const bankIdsStr = caseRow.bank_transaction_ids || '';
    const bIds = bankIdsStr.split(/[\s|;,]+/).filter(Boolean);

    for (const bId of bIds) {
      if (bId.toUpperCase() !== 'NONE' && bId.toUpperCase() !== 'NULL') {
        gtBankMap.set(bId, isMatched);
        if (isMatched) expectedMatchedBank++;
        else expectedUnmatchedBank++;
      }
    }

    // Check case level correctness
    let caseCorrect = true;
    for (const bId of bIds) {
      if (bId.toUpperCase() !== 'NONE' && bId.toUpperCase() !== 'NULL') {
        // Find canonical bank txn
        const canonical = bankTxns.find(b => b.sourceTxnId === bId || b.referenceId === bId);
        const wasMatched = canonical ? matchedBankIds.has(canonical.id) : false;
        if (wasMatched !== isMatched) {
          caseCorrect = false;
        }
      }
    }
    if (caseCorrect) casesMatchedCorrectly++;
  }

  // Fallbacks if ground truth CSV didn't list every bank ID explicitly
  if (expectedMatchedBank === 0) {
    expectedMatchedBank = gtBankMap.size;
  }
  if (expectedUnmatchedBank === 0 && totalBankRecords > expectedMatchedBank) {
    expectedUnmatchedBank = totalBankRecords - expectedMatchedBank;
  }

  const matchRate = (actualMatchedBank / totalBankRecords) * 100;
  const expectedMatchRate = (expectedMatchedBank / totalBankRecords) * 100;

  // Ground truth False Automation: bank txns that were auto-matched but ground truth says UNMATCHED
  let falsePositives = 0;
  for (const bId of matchedBankIds) {
    const canonical = bankTxns.find(b => b.id === bId);
    if (canonical) {
      const gtExpected = gtBankMap.get(canonical.sourceTxnId) ?? gtBankMap.get(canonical.referenceId || '');
      if (gtExpected === false) {
        falsePositives++;
      }
    }
  }

  const precision = actualMatchedBank > 0 ? ((actualMatchedBank - falsePositives) / actualMatchedBank) * 100 : 100;
  const recall = expectedMatchedBank > 0 ? ((actualMatchedBank - falsePositives) / expectedMatchedBank) * 100 : 0;
  const falseAutomationRate = actualMatchedBank > 0 ? (falsePositives / actualMatchedBank) * 100 : 0;
  // Compute Cardinality Breakdown across matches
  let count1to1 = 0;
  let count1toN = 0;
  let countNto1 = 0;
  let countNtoM = 0;

  for (const m of result.matches) {
    const bankCount = m.bankTxnIds.length;
    const internalCount = m.internalTxnIds.length;
    if (bankCount === 1 && internalCount === 1) count1to1++;
    else if (bankCount > 1 && internalCount === 1) count1toN++;
    else if (bankCount === 1 && internalCount > 1) countNto1++;
    else countNtoM++;
  }

  const totalRecordsProcessed = erpTxns.length + gatewayTxns.length + bankTxns.length;
  const totalGroups = result.matches.length;
  const correctlyMatchedGroups = result.matches.length - falsePositives;
  const reviewRate = (actualUnmatchedBank / totalBankRecords) * 100;

  return {
    datasetName,
    totalRecordsProcessed,
    totalBankRecords,
    expectedMatchedBank,
    actualMatchedBank,
    expectedUnmatchedBank,
    actualUnmatchedBank,
    totalGroups,
    correctlyMatchedGroups,
    incorrectlyMatchedGroups: falsePositives,
    cardinality1to1: count1to1,
    cardinality1toN: count1toN,
    cardinalityNto1: countNto1,
    cardinalityNtoM: countNtoM,
    matchRate: Number(matchRate.toFixed(2)),
    expectedMatchRate: Number(expectedMatchRate.toFixed(2)),
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    falseAutomationRate: Number(falseAutomationRate.toFixed(2)),
    reviewRate: Number(reviewRate.toFixed(2)),
    totalExceptions: result.exceptions.length,
    caseCount: rawGT.length,
    casesMatchedCorrectly,
  };
}

function runAllEvaluations() {
  console.log('================================================================');
  console.log('       RUNNING GROUND TRUTH EVALUATION ACROSS ALL 4 DATASETS     ');
  console.log('================================================================\n');

  const results = [];

  results.push(evaluateDataset('Dataset Level 1 (Basic)', 'dataset_level_1', 'dataset_level_1.csv'));
  results.push(evaluateDataset('Dataset Level 2 (Advanced)', 'dataset_level_2', 'dataset_level_2.csv'));
  results.push(evaluateDataset('Dataset Level 3 (Nightmare)', 'dataset_level_3', 'dataset_level_3.csv'));
  results.push(evaluateDataset('Dataset Mixed Test (Mixed)', 'dataset_mixed_test', 'dataset_mixed_test.csv'));

  console.table(results.map(r => ({
    Dataset: r.datasetName,
    'Total Recs': r.totalRecordsProcessed,
    'Bank Txns': r.totalBankRecords,
    'Exp Matched': r.expectedMatchedBank,
    'Act Matched': r.actualMatchedBank,
    '1:1 Groups': r.cardinality1to1,
    '1:N Groups': r.cardinality1toN,
    'N:1 Groups': r.cardinalityNto1,
    'N:M Groups': r.cardinalityNtoM,
    'Match Rate': `${r.matchRate}%`,
    Precision: `${r.precision}%`,
    Recall: `${r.recall}%`,
    'False Auto %': `${r.falseAutomationRate}%`,
    Exceptions: r.totalExceptions,
  })));

  fs.writeFileSync(
    path.join(__dirname, '../data/evaluation_summary.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('\nSaved evaluation summary to solution/data/evaluation_summary.json');
}

runAllEvaluations();
