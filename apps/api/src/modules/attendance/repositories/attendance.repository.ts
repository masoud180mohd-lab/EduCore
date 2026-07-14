/**
 * Persistence contract for Attendance.
 * No database adapter is provided before Database Freeze.
 */
export interface AttendanceRepository {
  readonly boundedContext: 'Attendance';
}

export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY');
