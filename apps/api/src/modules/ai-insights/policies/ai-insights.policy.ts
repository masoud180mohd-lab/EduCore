import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for AI Insights.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class AiInsightsPolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
