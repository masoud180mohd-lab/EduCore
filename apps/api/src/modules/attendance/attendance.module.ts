import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { AttendanceSessionsService } from './application/attendance-sessions.service.js';
import { AttendanceApplicationService } from './application/attendance.application-service.js';
import { AttendanceController } from './controllers/attendance.controller.js';
import { AttendanceDomainService } from './domain/attendance.domain-service.js';
import { AttendancePolicy } from './policies/attendance.policy.js';
import { ATTENDANCE_REPOSITORY } from './repositories/attendance.repository.js';
import { AttendanceRepositoryPlaceholder } from './repositories/attendance.repository.placeholder.js';
import { AttendanceSessionsRepository } from './repositories/attendance-sessions.repository.js';

/**
 * Bounded context: Attendance.
 * Sessions + records product surfaces (ACF-009 / DBF-009).
 */
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceApplicationService,
    AttendanceDomainService,
    AttendancePolicy,
    {
      provide: ATTENDANCE_REPOSITORY,
      useClass: AttendanceRepositoryPlaceholder,
    },
    AttendanceSessionsRepository,
    AttendanceSessionsService,
  ],
  exports: [AttendanceApplicationService, ATTENDANCE_REPOSITORY, AttendanceSessionsService],
})
export class AttendanceModule {}
