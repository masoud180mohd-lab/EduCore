import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-005 attendance structural', () => {
  it('registers list/detail/create/close/records with attendance permissions', () => {
    const ctrl = read('apps/api/src/modules/attendance/controllers/attendance.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/attendance-sessions')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Post(':id/close')");
    expect(ctrl).toContain("@Get(':id/records')");
    expect(ctrl).toContain("@Put(':id/records')");
    expect(ctrl).toContain("RequirePermission('attendance.read')");
    expect(ctrl).toContain("RequirePermission('attendance.manage')");
    expect(ctrl).not.toMatch(/@(Patch|Delete)\(/);
  });

  it('wires AttendanceSessions* in attendance module only', () => {
    const mod = read('apps/api/src/modules/attendance/attendance.module.ts');
    expect(mod).toContain('AttendanceSessionsRepository');
    expect(mod).toContain('AttendanceSessionsService');
    expect(mod).toContain('AttendanceController');
    const academic = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(academic).not.toContain('AttendanceSessions');
  });

  it('documents freezes and task records', () => {
    expect(read('docs/engineering/database-freeze/DBF-009-attendance-slice.md')).toContain(
      'DBF-009',
    );
    const acf = read('docs/engineering/api-contract-freeze/ACF-009-attendance-slice.md');
    expect(acf).toContain('attendance.read');
    expect(acf).toContain('attendance.manage');
    expect(acf).toContain('/api/v1/attendance-sessions');
    expect(acf).toContain('1.3');
  });

  it('migrations: SELECT-only tables + write helpers with enrollment gate', () => {
    const tables = read('apps/api/db/migrations/20260721010000_attendance_sessions_records.up.sql');
    expect(tables).toMatch(/CREATE TABLE attendance_sessions/i);
    expect(tables).toMatch(/CREATE TABLE attendance_records/i);
    expect(tables).toContain('GRANT SELECT ON TABLE attendance_sessions TO educore_app');
    expect(tables).toContain('attendance.read');
    expect(tables).toContain('attendance.manage');
    const helpers = read('apps/api/db/migrations/20260721020000_attendance_write_helpers.up.sql');
    expect(helpers).toContain('app.create_attendance_session');
    expect(helpers).toContain('app.close_attendance_session');
    expect(helpers).toContain('app.upsert_attendance_record');
    expect(helpers).toContain('student not enrolled');
  });

  it('points ACF freezes at machine OpenAPI for enrollments+attendance', () => {
    const acf8 = read('docs/engineering/api-contract-freeze/ACF-008-enrollments-slice.md');
    const acf9 = read('docs/engineering/api-contract-freeze/ACF-009-attendance-slice.md');
    expect(acf8).toContain('acf-008-009-enrollments-attendance.openapi.yaml');
    expect(acf9).toContain('acf-008-009-enrollments-attendance.openapi.yaml');
  });
});
