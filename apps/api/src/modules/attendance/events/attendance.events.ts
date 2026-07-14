/**
 * Domain-event names for Attendance.
 * Event payloads and outbox publishing remain deferred.
 */
export const AttendanceEventNames = {
  skeletonRegistered: 'attendance.skeleton.registered',
} as const;

export type AttendanceSkeletonRegisteredEvent = {
  readonly eventName: typeof AttendanceEventNames.skeletonRegistered;
  readonly boundedContext: 'Attendance';
};
