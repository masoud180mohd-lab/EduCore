/**
 * Persistence contract for Finance Ledger.
 * No database adapter is provided before Database Freeze.
 */
export interface FinanceLedgerRepository {
  readonly boundedContext: 'Finance Ledger';
}

export const FINANCE_LEDGER_REPOSITORY = Symbol('FINANCE_LEDGER_REPOSITORY');
