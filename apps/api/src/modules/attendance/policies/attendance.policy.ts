import { Injectable } from '@nestjs/common';

/**
 * Authorization policy placeholder for Attendance.
 * Deny-by-default production policy engine is a later Sprint 0/1 deliverable.
 */
@Injectable()
export class AttendancePolicy {
  /**
   * Skeleton policies never grant access.
   */
  isAllowed(): false {
    return false;
  }
}
