import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-004 enrollments structural', () => {
  it('registers list/detail/create/patch with academic permissions', () => {
    const ctrl = read(
      'apps/api/src/modules/academic-structure/controllers/enrollments.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/enrollments')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).toContain("RequirePermission('academic.manage')");
    expect(ctrl).not.toMatch(/@(Put|Delete)\(/);
    expect(ctrl.indexOf('@Get()')).toBeLessThan(ctrl.indexOf('@Post()'));
    expect(ctrl.indexOf('@Post()')).toBeLessThan(ctrl.indexOf("@Get(':id')"));
  });

  it('wires Enrollments* in academic-structure only', () => {
    const mod = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(mod).toContain('EnrollmentsController');
    expect(mod).toContain('EnrollmentsService');
    expect(mod).toContain('EnrollmentsRepository');
    const studentMod = read('apps/api/src/modules/student-registry/student-registry.module.ts');
    expect(studentMod).not.toContain('Enrollments');
  });

  it('documents freezes and task record', () => {
    expect(read('docs/engineering/database-freeze/DBF-008-enrollments-slice.md')).toContain(
      'DBF-008',
    );
    const acf = read('docs/engineering/api-contract-freeze/ACF-008-enrollments-slice.md');
    expect(acf).toContain('listEnrollments');
    expect(acf).toContain('getEnrollment');
    expect(acf).toContain('createEnrollment');
    expect(acf).toContain('patchEnrollment');
    expect(acf).toContain('1.3');
    expect(read('docs/engineering/task-records/IMP-004-E0-enrollments-foundation.md')).toContain(
      'IMP-004',
    );
  });

  it('migrations: SELECT-only table + write helpers', () => {
    const list = read('apps/api/db/migrations/20260720290000_enrollments_list_read.up.sql');
    expect(list).toMatch(/CREATE TABLE enrollments/i);
    expect(list).toContain('GRANT SELECT ON TABLE enrollments TO educore_app');
    expect(list).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE enrollments FROM educore_app');
    expect(list).toContain('uq_enrollments_active_suspended');
    const write = read('apps/api/db/migrations/20260720300000_enrollments_write_helpers.up.sql');
    expect(write).toContain('app.create_enrollment');
    expect(write).toContain('app.update_enrollment_status');
    expect(write).toContain('student not found');
    expect(write).toContain('class not found');
    expect(write).toContain('stream not found');
  });
});
