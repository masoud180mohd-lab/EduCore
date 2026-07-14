/**
 * Persistence contract for Tenant And Billing.
 * No database adapter is provided before Database Freeze.
 */
export interface TenantAndBillingRepository {
  readonly boundedContext: 'Tenant And Billing';
}

export const TENANT_AND_BILLING_REPOSITORY = Symbol('TENANT_AND_BILLING_REPOSITORY');
