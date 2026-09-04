import { CanonicalTransaction } from './types';
import { parseToMinorUnits } from './currency';
import Papa from 'papaparse';

// ── Schema mapping returned by LLM or heuristic detection ─────────────────────
export interface SchemaMapping {
  date?: string;
  amount?: string;
  credit?: string;
  debit?: string;
  reference?: string;
  description?: string;
  fee?: string;
  tax?: string;
  settlement_id?: string;
  invoice?: string;
  customer?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDynamicVal(raw: any, keywords: string[]): string {
  if (!raw) return '';
  const actualKeys = Object.keys(raw);
  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase();
    const matchingKey = actualKeys.find(k => k.toLowerCase().includes(lowerKw));
    if (matchingKey && raw[matchingKey] !== undefined && raw[matchingKey] !== null && String(raw[matchingKey]).trim() !== '') {
      return String(raw[matchingKey]).trim();
    }
  }
  return '';
}

function getByCol(raw: any, col: string | undefined): string {
  if (!col || !raw) return '';
  const val = raw[col];
  return val !== undefined && val !== null ? String(val).trim() : '';
}

function parseSafeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ── Heuristic confidence check ────────────────────────────────────────────────
// Returns true if heuristic detection found at least date + amount
export function hasGoodHeuristicConfidence(raw: any): boolean {
  const date = getDynamicVal(raw, ['date', 'time', 'timestamp', 'created']);
  const amount = getDynamicVal(raw, ['amount', 'credit', 'debit', 'total', 'net', 'value']);
  return date !== '' && amount !== '';
}

// ── LLM Schema Inference (fallback, called once per CSV file) ─────────────────
export async function inferSchemaFromLLM(
  headers: string[],
  sampleRows: any[]
): Promise<SchemaMapping> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[Schema] No OPENROUTER_API_KEY, skipping LLM schema inference.');
    return {};
  }

  const prompt = `You are a financial data schema expert. Given the following CSV headers and first 2 sample rows from a financial CSV file, identify which column corresponds to each financial field.

Headers: ${JSON.stringify(headers)}
Row 1: ${JSON.stringify(sampleRows[0] ?? {})}
Row 2: ${JSON.stringify(sampleRows[1] ?? {})}

Return ONLY a valid JSON object mapping these field names to the EXACT column header string from the CSV above. Use null if a field doesn't exist.

Fields to detect:
- date: the transaction date column
- amount: the main monetary amount column (if single amount column)
- credit: the credit/deposit column (if separate credit/debit columns)
- debit: the debit/withdrawal column (if separate credit/debit columns)
- reference: the transaction reference ID / UTR / payment ID
- description: the narration / description / remarks column
- fee: transaction fee or charge (optional)
- tax: GST or tax amount (optional)
- settlement_id: settlement or batch ID (optional)
- invoice: invoice number (optional, ERP only)
- customer: customer name (optional, ERP only)

Return ONLY JSON, no explanation. Example:
{"date":"ValDt","amount":null,"credit":"CrAmt","debit":"DrAmt","reference":"TxnRef","description":"Narration","fee":"Fee","tax":"GST","settlement_id":null,"invoice":null,"customer":null}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31B-it',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';

    // Extract JSON from the response (LLM might wrap in ```json ... ```)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Schema] LLM returned no JSON:', content);
      return {};
    }

    const schema: SchemaMapping = JSON.parse(jsonMatch[0]);
    console.log('[Schema] LLM inferred schema:', schema);
    return schema;
  } catch (err) {
    console.error('[Schema] LLM schema inference failed:', err);
    return {};
  }
}

// ── Normalize using LLM-provided schema mapping ───────────────────────────────
export function normalizeWithSchema(
  raw: any,
  schema: SchemaMapping,
  sourceType: 'BANK' | 'ERP' | 'GATEWAY'
): CanonicalTransaction {
  const dateStr = parseSafeDate(getByCol(raw, schema.date));
  const ref = getByCol(raw, schema.reference);
  const desc = getByCol(raw, schema.description);

  let amount = 0;
  let type: 'CREDIT' | 'DEBIT' = 'CREDIT';

  if (schema.credit && getByCol(raw, schema.credit)) {
    amount = parseToMinorUnits(getByCol(raw, schema.credit));
    type = 'CREDIT';
  } else if (schema.debit && getByCol(raw, schema.debit)) {
    amount = parseToMinorUnits(getByCol(raw, schema.debit));
    type = 'DEBIT';
  } else if (schema.amount && getByCol(raw, schema.amount)) {
    amount = parseToMinorUnits(getByCol(raw, schema.amount));
    type = 'CREDIT';
  }

  const fee = parseToMinorUnits(getByCol(raw, schema.fee));
  const tax = parseToMinorUnits(getByCol(raw, schema.tax));
  const settlementId = getByCol(raw, schema.settlement_id);
  const invoice = getByCol(raw, schema.invoice);
  const customer = getByCol(raw, schema.customer);

  const id = crypto.randomUUID();

  const descFinal = desc
    || (sourceType === 'ERP' ? `Invoice: ${customer} - ${invoice}` : '')
    || (sourceType === 'GATEWAY' ? `PG Settlement: ${ref}` : '')
    || ref;

  return {
    id,
    sourceTxnId: ref || invoice || id,
    sourceType,
    type,
    amount,
    fee,
    tax,
    currency: 'INR',
    date: dateStr,
    description: descFinal,
    utr: ref,
    referenceId: ref || invoice,
    settlementId: settlementId || undefined,
    metadata: { ...raw, _schemaSource: 'LLM' },
  };
}

// ── Heuristic normalizers (Tier 1 — fast path) ───────────────────────────────

export function normalizeBank(raw: any): CanonicalTransaction {
  const dateStr = getDynamicVal(raw, ['date', 'time', 'timestamp', 'created']);
  const desc = getDynamicVal(raw, ['desc', 'narration', 'remark', 'particulars', 'detail']);
  const ref = getDynamicVal(raw, ['ref', 'utr', 'txn', 'id', 'no', 'transaction']);

  const utrMatch = desc.match(/[A-Z0-9]{10,22}/);
  const utr = utrMatch ? utrMatch[0] : ref;

  let amount = 0;
  let type: 'CREDIT' | 'DEBIT' = 'CREDIT';

  const creditStr = getDynamicVal(raw, ['credit', 'deposit', 'in']);
  const debitStr  = getDynamicVal(raw, ['debit', 'withdrawal', 'out']);
  const amountStr = getDynamicVal(raw, ['amount', 'value', 'total']);

  if (creditStr) {
    amount = parseToMinorUnits(creditStr);
    type = 'CREDIT';
  } else if (debitStr) {
    amount = parseToMinorUnits(debitStr);
    type = 'DEBIT';
  } else if (amountStr) {
    amount = parseToMinorUnits(amountStr);
    type = 'CREDIT';
  }

  return {
    id: crypto.randomUUID(),
    sourceTxnId: ref || crypto.randomUUID(),
    sourceType: 'BANK',
    type,
    amount,
    fee: 0,
    tax: 0,
    currency: 'INR',
    date: parseSafeDate(dateStr),
    description: desc,
    utr,
    referenceId: ref,
    metadata: { ...raw, _schemaSource: 'heuristic' },
  };
}

export function normalizeERP(raw: any): CanonicalTransaction {
  const dateStr  = getDynamicVal(raw, ['date', 'created', 'time']);
  const amountStr = getDynamicVal(raw, ['amount', 'total', 'value', 'price']);
  const invoice  = getDynamicVal(raw, ['invoice', 'bill', 'order']);
  const customer = getDynamicVal(raw, ['customer', 'client', 'user', 'name']);
  const ref      = getDynamicVal(raw, ['ref', 'payment', 'txn']);

  return {
    id: crypto.randomUUID(),
    sourceTxnId: invoice || crypto.randomUUID(),
    sourceType: 'ERP',
    type: 'CREDIT',
    amount: parseToMinorUnits(amountStr),
    fee: 0,
    tax: 0,
    currency: 'INR',
    date: parseSafeDate(dateStr),
    description: `Invoice: ${customer} - ${invoice}`,
    referenceId: ref || invoice,
    metadata: { ...raw, _schemaSource: 'heuristic' },
  };
}

export function extractBaseGroup(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const parts = ref.split('-');
  if (parts.length >= 3) {
    return parts.slice(0, parts.length - 1).join('-');
  }
  return ref;
}

export function normalizeGateway(raw: any): CanonicalTransaction {
  const dateStr   = getDynamicVal(raw, ['event_date', 'date', 'created', 'time']);
  // Prefer net_settlement (after fees) over gross_amount — this is what hits the bank account
  const amountStr = getDynamicVal(raw, ['net_settlement', 'net_amount', 'net', 'amount', 'gross']);
  const feeStr    = getDynamicVal(raw, ['gateway_fee', 'fee', 'charge', 'deduction']);
  const taxStr    = getDynamicVal(raw, ['gst_on_fee', 'gst', 'tax', 'vat']);
  // gateway_txn_id is the UNIQUE row identifier (G001, G002...)
  const uniqueId  = getDynamicVal(raw, ['gateway_txn_id']);
  // merchant_ref / settlement_batch is the BATCH grouping key — multiple rows share it intentionally
  const batchRef  = getDynamicVal(raw, ['merchant_ref', 'settlement_batch', 'batch', 'settlement', 'payout']);
  const eventType = getDynamicVal(raw, ['event_type', 'type', 'event']);

  // Fallback: if no gateway_txn_id column, try generic ID columns
  const fallbackId = uniqueId || getDynamicVal(raw, ['txn_id', 'id', 'pay']);

  const amount = parseToMinorUnits(amountStr);
  const fee    = parseToMinorUnits(feeStr);
  const tax    = parseToMinorUnits(taxStr);
  const id     = crypto.randomUUID();
  const baseSettlementGroup = extractBaseGroup(batchRef);

  return {
    id,
    // Use the unique row ID — NOT the batch ref — to prevent false duplicates
    sourceTxnId: fallbackId || id,
    sourceType: 'GATEWAY',
    type: amount >= 0 ? 'CREDIT' : 'DEBIT',
    amount,
    fee,
    tax,
    currency: 'INR',
    date: parseSafeDate(dateStr),
    description: `PG: ${batchRef || fallbackId} (${eventType || 'Settlement'})`,
    // merchant_ref groups multiple gateway rows into one settlement batch
    settlementId: baseSettlementGroup || undefined,
    referenceId: batchRef || fallbackId,
    metadata: { ...raw, _schemaSource: 'heuristic' },
  };
}

/**
 * Generic CSV parser.
 */
export function parseCSV<T>(csvText: string): T[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) console.warn('CSV parsing errors:', result.errors);
  return result.data as T[];
}
