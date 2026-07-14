/**
 * Domain-event names for Tenant And Billing.
 * Event payloads and outbox publishing remain deferred.
 */
export const TenantAndBillingEventNames = {
  skeletonRegistered: 'tenant-and-billing.skeleton.registered',
} as const;

export type TenantAndBillingSkeletonRegisteredEvent = {
  readonly eventName: typeof TenantAndBillingEventNames.skeletonRegistered;
  readonly boundedContext: 'Tenant And Billing';
};
