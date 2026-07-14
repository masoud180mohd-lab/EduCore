/**
 * Domain-event names for Payments.
 * Event payloads and outbox publishing remain deferred.
 */
export const PaymentsEventNames = {
  skeletonRegistered: 'payments.skeleton.registered',
} as const;

export type PaymentsSkeletonRegisteredEvent = {
  readonly eventName: typeof PaymentsEventNames.skeletonRegistered;
  readonly boundedContext: 'Payments';
};
