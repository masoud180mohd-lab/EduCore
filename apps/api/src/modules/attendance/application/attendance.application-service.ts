import { Inject, Injectable } from '@nestjs/common';

import { AttendanceDomainService } from '../domain/attendance.domain-service.js';
import { AttendancePolicy } from '../policies/attendance.policy.js';
import type { AttendanceRepository } from '../repositories/attendance.repository.js';
import { ATTENDANCE_REPOSITORY } from '../repositories/attendance.repository.js';

/**
 * Application-service placeholder for Attendance.
 * Use-case orchestration is deferred until the approved feature slice.
 */
@Injectable()
export class AttendanceApplicationService {
  constructor(
    private readonly domainService: AttendanceDomainService,
    private readonly policy: AttendancePolicy,
    @Inject(ATTENDANCE_REPOSITORY) private readonly repository: AttendanceRepository,
  ) {}

  /**
   * Proves the skeleton wiring without executing domain behaviour.
   */
  describeSkeleton(): { readonly boundedContext: string; readonly ready: false } {
    void this.domainService;
    void this.policy;
    void this.repository;
    return {
      boundedContext: 'Attendance',
      ready: false,
    };
  }
}
