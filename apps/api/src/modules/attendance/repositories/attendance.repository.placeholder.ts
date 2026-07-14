import { Injectable } from '@nestjs/common';

import type { AttendanceRepository } from './attendance.repository.js';

/**
 * Non-persistent repository placeholder for Attendance.
 */
@Injectable()
export class AttendanceRepositoryPlaceholder implements AttendanceRepository {
  readonly boundedContext = 'Attendance' as const;
}
