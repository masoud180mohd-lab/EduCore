import { describe, expect, it } from 'vitest';

import { AttendanceApplicationService } from '../application/attendance.application-service.js';
import { AttendanceDomainService } from '../domain/attendance.domain-service.js';
import { AttendanceEventNames } from '../events/attendance.events.js';
import { AttendanceModule } from '../attendance.module.js';
import { AttendancePolicy } from '../policies/attendance.policy.js';

describe('Attendance module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(AttendanceModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new AttendanceApplicationService(
      new AttendanceDomainService(),
      new AttendancePolicy(),
      { boundedContext: 'Attendance' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Attendance',
      ready: false,
    });
    expect(new AttendancePolicy().isAllowed()).toBe(false);
    expect(AttendanceEventNames.skeletonRegistered).toBe('attendance.skeleton.registered');
  });
});
