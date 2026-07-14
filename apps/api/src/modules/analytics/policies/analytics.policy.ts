import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for Analytics.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class AnalyticsPolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
