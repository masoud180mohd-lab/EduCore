import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for Tenant And Billing.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class TenantAndBillingPolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
