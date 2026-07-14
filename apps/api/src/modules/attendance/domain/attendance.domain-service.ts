import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Attendance.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class AttendanceDomainService {
  contextName(): string {
    return 'Attendance';
  }
}
