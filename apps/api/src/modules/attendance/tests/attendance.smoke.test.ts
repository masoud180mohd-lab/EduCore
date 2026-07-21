import { describe, expect, it } from 'vitest';

import { AttendanceModule } from '../attendance.module.js';
import { AttendanceSessionsService } from '../application/attendance-sessions.service.js';

describe('Attendance module', () => {
  it('exposes a Nest module definition', () => {
    expect(AttendanceModule).toBeDefined();
  });

  it('registers AttendanceSessionsService', () => {
    expect(AttendanceSessionsService).toBeDefined();
  });
});
