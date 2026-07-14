/**
 * Neutral DTO namespace for Tenant And Billing.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type TenantAndBillingSkeletonDto = {
  readonly boundedContext: 'Tenant And Billing';
  readonly status: 'skeleton';
};

export const TENANT_AND_BILLING_SKELETON_DTO: TenantAndBillingSkeletonDto = {
  boundedContext: 'Tenant And Billing',
  status: 'skeleton',
};
