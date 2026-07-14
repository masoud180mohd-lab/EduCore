/**
 * Neutral DTO namespace for Finance Ledger.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type FinanceLedgerSkeletonDto = {
  readonly boundedContext: 'Finance Ledger';
  readonly status: 'skeleton';
};

export const FINANCE_LEDGER_SKELETON_DTO: FinanceLedgerSkeletonDto = {
  boundedContext: 'Finance Ledger',
  status: 'skeleton',
};
