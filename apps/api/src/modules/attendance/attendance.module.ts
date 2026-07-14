import { Module } from '@nestjs/common';

import { AttendanceApplicationService } from './application/attendance.application-service.js';
import { AttendanceController } from './controllers/attendance.controller.js';
import { AttendanceDomainService } from './domain/attendance.domain-service.js';
import { AttendancePolicy } from './policies/attendance.policy.js';
import { ATTENDANCE_REPOSITORY } from './repositories/attendance.repository.js';
import { AttendanceRepositoryPlaceholder } from './repositories/attendance.repository.placeholder.js';

/**
 * Bounded context skeleton: Attendance.
 * No business routes, persistence, or domain rules are implemented in PLAT-003.
 */
@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceApplicationService,
    AttendanceDomainService,
    AttendancePolicy,
    {
      provide: ATTENDANCE_REPOSITORY,
      useClass: AttendanceRepositoryPlaceholder,
    },
  ],
  exports: [AttendanceApplicationService, ATTENDANCE_REPOSITORY],
})
export class AttendanceModule {}
