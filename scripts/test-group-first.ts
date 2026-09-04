import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { normalizeBank, normalizeERP, normalizeGateway } from '../lib/normalization';
import { solveSubsetSum } from '../lib/reconciliation/pass3-solver';
import { hasDescriptionConflict } from '../lib/reconciliation/conflict-detector';

function testGroupFirst() {
  const bankPath = path.join(__dirname, '../data/dataset2/rigorous_bank_statement.csv');
  const erpPath = path.join(__dirname, '../data/dataset2/rigorous_erp_ledger.csv');
  const gwPath = path.join(__dirname, '../data/dataset2/rigorous_payment_gateway.csv');

  const rawBank = Papa.parse(fs.readFileSync(bankPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawERP = Papa.parse(fs.readFileSync(erpPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];
  const rawGW = Papa.parse(fs.readFileSync(gwPath, 'utf8'), { header: true, skipEmptyLines: true }).data as any[];

  const bankTxns = rawBank.map(normalizeBank);
  const erpTxns = rawERP.map(normalizeERP);
  const gatewayTxns = rawGW.map(normalizeGateway);

  const matchedBankIds = new Set<string>();
  const matchedGwIds = new Set<string>();
  const matches: any[] = [];

  // Group gateway transactions by base merchant_ref prefix (e.g. SPLIT-66, NM-91, BULK-52)
  const gwGroups = new Map<string, typeof gatewayTxns>();
  for (const g of gatewayTxns) {
    const ref = g.settlementId || g.referenceId || g.sourceTxnId;
    // Extract base group name (e.g. BULK-52-1 -> BULK-52, NM-91-0 -> NM-91)
    const parts = ref.split('-');
    let baseGroup = ref;
    if (parts.length >= 3 && (parts[0] === 'BULK' || parts[0] === 'NM')) {
      baseGroup = `${parts[0]}-${parts[1]}`;
    }
    const arr = gwGroups.get(baseGroup) || [];
    arr.push(g);
    gwGroups.set(baseGroup, arr);
  }

  console.log(`Total Gateway Groups formed: ${gwGroups.size}`);

  // Step 1: Process multi-item Gateway Groups first (BULK, SPLIT, NM, REF)
  for (const [groupKey, group] of gwGroups.entries()) {
    const netSum = group.reduce((s, g) => s + g.amount, 0);
    const latestGwDate = group.reduce((d, g) => g.date > d ? g.date : d, group[0].date);

    // Try 1: Single bank entry exact net sum
    let bankMatch = bankTxns.find(b =>
      !matchedBankIds.has(b.id) &&
      !hasDescriptionConflict(b, group) &&
      Math.abs(b.amount - netSum) <= 5 &&
      Math.abs(new Date(b.date).getTime() - new Date(latestGwDate).getTime()) <= 15 * 86400000
    );

    if (bankMatch) {
      matchedBankIds.add(bankMatch.id);
      group.forEach(g => matchedGwIds.add(g.id));
      matches.push({ type: 'GROUP_1:1_OR_N:1', groupKey, bankIds: [bankMatch.id], gwIds: group.map(g => g.id) });
      continue;
    }

    // Try 2: Subset-sum on Bank entries for this group net sum
    const availBank = bankTxns.filter(b =>
      !matchedBankIds.has(b.id) &&
      !hasDescriptionConflict(b, group) &&
      Math.abs(new Date(b.date).getTime() - new Date(latestGwDate).getTime()) <= 20 * 86400000
    );

    const bankItems = availBank.map(b => ({ id: b.id, amount: b.amount }));
    const subsetIds = solveSubsetSum(netSum, bankItems, 10, 5);

    if (subsetIds && subsetIds.length > 0) {
      subsetIds.forEach(id => matchedBankIds.add(id));
      group.forEach(g => matchedGwIds.add(g.id));
      matches.push({ type: 'GROUP_N:M', groupKey, bankIds: subsetIds, gwIds: group.map(g => g.id) });
    }
  }

  console.log(`After Group Matching: ${matchedBankIds.size} / ${bankTxns.length} Bank records matched.`);

  // Step 2: Match remaining single Gateway txns to single Bank txns (1:1)
  const remainingGw = gatewayTxns.filter(g => !matchedGwIds.has(g.id) && g.amount > 0);
  for (const gw of remainingGw) {
    const bankMatch = bankTxns.find(b =>
      !matchedBankIds.has(b.id) &&
      !hasDescriptionConflict(b, [gw]) &&
      Math.abs(b.amount - gw.amount) <= 5 &&
      Math.abs(new Date(b.date).getTime() - new Date(gw.date).getTime()) <= 15 * 86400000
    );

    if (bankMatch) {
      matchedBankIds.add(bankMatch.id);
      matchedGwIds.add(gw.id);
      matches.push({ type: 'SINGLE_1:1', bankIds: [bankMatch.id], gwIds: [gw.id] });
    }
  }

  console.log(`After Single 1:1 Matching: ${matchedBankIds.size} / ${bankTxns.length} Bank records matched.`);
  console.log(`Match Rate: ${((matchedBankIds.size / bankTxns.length) * 100).toFixed(2)}%`);
  console.log(`Unmatched Bank Credits: ${bankTxns.length - matchedBankIds.size}`);
}

testGroupFirst();
