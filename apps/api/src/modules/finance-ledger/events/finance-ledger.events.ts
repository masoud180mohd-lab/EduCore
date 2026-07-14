/**
 * Domain-event names for Finance Ledger.
 * Event payloads and outbox publishing remain deferred.
 */
export const FinanceLedgerEventNames = {
  skeletonRegistered: 'finance-ledger.skeleton.registered',
} as const;

export type FinanceLedgerSkeletonRegisteredEvent = {
  readonly eventName: typeof FinanceLedgerEventNames.skeletonRegistered;
  readonly boundedContext: 'Finance Ledger';
};
