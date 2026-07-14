import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for Integrations.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class IntegrationsPolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
