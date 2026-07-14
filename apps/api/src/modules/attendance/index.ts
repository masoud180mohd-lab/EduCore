/**
 * Public API for the Attendance bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { AttendanceModule } from './attendance.module.js';
export { AttendanceApplicationService } from './application/attendance.application-service.js';
export { AttendanceEventNames } from './events/attendance.events.js';
export type { AttendanceSkeletonRegisteredEvent } from './events/attendance.events.js';
export { ATTENDANCE_SKELETON_DTO } from './dto/attendance.dto.js';
export type { AttendanceSkeletonDto } from './dto/attendance.dto.js';
export { ATTENDANCE_REPOSITORY } from './repositories/attendance.repository.js';
export type { AttendanceRepository } from './repositories/attendance.repository.js';
