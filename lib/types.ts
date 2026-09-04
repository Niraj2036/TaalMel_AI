export type SourceType = 'BANK' | 'ERP' | 'GATEWAY';
export type Currency = 'INR' | 'USD';

export enum ExceptionType {
  FEE_MISMATCH = 'FEE_MISMATCH',
  TDS_ANOMALY = 'TDS_ANOMALY',
  MISSING_IN_BANK = 'MISSING_IN_BANK',
  MISSING_IN_LEDGER = 'MISSING_IN_LEDGER',
  TIMING_LAG = 'TIMING_LAG',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  DUPLICATE = 'DUPLICATE',
  AMBIGUOUS_MATCH = 'AMBIGUOUS_MATCH',
  DATA_ERROR = 'DATA_ERROR'
}

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CanonicalTransaction {
  id: string; // Unique identifier for the transaction within our system
  sourceTxnId: string; // Original transaction ID from the source system
  sourceType: SourceType; // System the record originated from
  type: 'CREDIT' | 'DEBIT';
  amount: number; // Stored as minor units (paise) for precision
  fee: number; // Stored as minor units (paise)
  tax: number; // Stored as minor units (paise)
  currency: Currency;
  date: string; // ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ)
  description: string; // Narration or description
  utr?: string; // Unique Transaction Reference
  settlementId?: string; // Gateway settlement ID if applicable
  referenceId?: string; // Other reference IDs
  metadata: Record<string, any>; // Store extra raw fields for auditing
}

export interface RawBankRecord {
  'Date': string;
  'Description': string;
  'Reference No.': string;
  'Debit': string;
  'Credit': string;
  'Balance'?: string;
}

export interface RawERPRecord {
  'Invoice Number': string;
  'Customer': string;
  'Date': string;
  'Total Amount': string;
  'Status': string;
  'Payment Reference'?: string;
}

export interface RawGatewayRecord {
  'Payment ID': string;
  'Date': string;
  'Amount': string;
  'Fee': string;
  'Tax': string;
  'Settlement ID'?: string;
  'Status': string;
}

export interface MatchResult {
  matchId: string;
  internalTxnIds: string[];
  bankTxnIds: string[];
  matchType: '1:1' | '1:N' | 'N:1' | 'N:M';
  confidenceScore: number;
  evidence: string[];
}

export interface ExceptionData {
  exceptionId: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  relatedTxnIds: string[]; // Can be internal or bank
  amountDifference?: number; // In minor units
  metadata?: Record<string, any>;
}

export interface RunMetrics {
  totalInternalProcessed: number;
  totalBankProcessed: number;
  matchedCount: number;
  exceptionCount: number;
  matchRate: number; // Percentage
  totalAmountReconciled: number; // Minor units
  processingTimeMs: number;
}

export interface ReconciliationResult {
  runId: string;
  timestamp: string;
  metrics: RunMetrics;
  matches: MatchResult[];
  exceptions: ExceptionData[];
}

export interface EvidenceGateResult {
  isProven: boolean;
  score: number;
  reasoning: string[];
  competingExplanations: number;
}

export interface JournalProposal {
  proposalId: string;
  description: string;
  lines: {
    accountId: string;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
  }[];
}

export interface Policy {
  id: string;
  name: string;
  feePercentage?: number; // Example: 0.02 for 2%
  tdsRate?: number; // Example: 0.1 for 10%
  description?: string;
}
