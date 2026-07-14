/**
 * Neutral DTO namespace for Attendance.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type AttendanceSkeletonDto = {
  readonly boundedContext: 'Attendance';
  readonly status: 'skeleton';
};

export const ATTENDANCE_SKELETON_DTO: AttendanceSkeletonDto = {
  boundedContext: 'Attendance',
  status: 'skeleton',
};
