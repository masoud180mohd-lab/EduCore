import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for Student Registry.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class StudentRegistryPolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
