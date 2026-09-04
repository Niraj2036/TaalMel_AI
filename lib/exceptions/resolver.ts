import { ExceptionData, ExceptionType, Policy, JournalProposal } from '../types';

/**
 * Tier 1 deterministic exception resolver.
 * Analyzes exceptions against business policies (like known fee rates, TDS)
 * and proposes journal entries if a deterministic resolution is found.
 */
export function resolveException(exception: ExceptionData, policies: Policy[]): JournalProposal | null {
  if (exception.type !== ExceptionType.AMOUNT_MISMATCH && exception.type !== ExceptionType.FEE_MISMATCH) {
    // Only handling amount/fee related discrepancies deterministically for now
    return null;
  }

  if (!exception.amountDifference) {
    return null;
  }

  // We need to know the base amount to calculate % fees. 
  // In a real system, we'd fetch the base transaction amount from DB using relatedTxnIds.
  // For this mock implementation, we assume we can infer it or we receive it in metadata.
  const baseAmount = exception.metadata?.baseAmount as number | undefined;
  if (!baseAmount) return null;

  for (const policy of policies) {
    if (policy.feePercentage) {
      const expectedFee = Math.round(baseAmount * policy.feePercentage);
      // Allow small rounding tolerance (e.g., 1 paise)
      if (Math.abs(expectedFee - exception.amountDifference) <= 1) {
        // Matched fee policy, generate journal proposal
        const proposalId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        
        return {
          proposalId,
          description: `Auto-resolve: Apply known fee policy (${policy.name})`,
          lines: [
            {
              accountId: 'FEE_EXPENSE_ACCOUNT', // Placeholder for actual account ID
              type: 'DEBIT',
              amount: exception.amountDifference
            },
            {
              accountId: 'BANK_ACCOUNT',
              type: 'CREDIT',
              amount: exception.amountDifference
            }
          ]
        };
      }
    }
    
    if (policy.tdsRate) {
      const expectedTds = Math.round(baseAmount * policy.tdsRate);
      if (Math.abs(expectedTds - exception.amountDifference) <= 1) {
        const proposalId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        
        return {
          proposalId,
          description: `Auto-resolve: Apply known TDS policy (${policy.name})`,
          lines: [
            {
              accountId: 'TDS_RECEIVABLE_ACCOUNT', 
              type: 'DEBIT',
              amount: exception.amountDifference
            },
            {
              accountId: 'CUSTOMER_RECEIVABLE_ACCOUNT',
              type: 'CREDIT',
              amount: exception.amountDifference
            }
          ]
        };
      }
    }
  }

  // No policy matched deterministically
  return null;
}

/**
 * Validates that a journal proposal satisfies double-entry accounting rules.
 * sum(Debits) === sum(Credits)
 */
export function validateDoubleEntry(proposal: JournalProposal): boolean {
  let debits = 0;
  let credits = 0;
  
  for (const line of proposal.lines) {
    if (line.type === 'DEBIT') debits += line.amount;
    if (line.type === 'CREDIT') credits += line.amount;
  }
  
  return debits === credits;
}
