import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-002 students list + detail + create + patch structural', () => {
  it('registers GET list/detail + POST create + PATCH with permissions and no delete', () => {
    const ctrl = read('apps/api/src/modules/student-registry/controllers/students.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/students')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("RequirePermission('student.read')");
    expect(ctrl).toContain("RequirePermission('student.manage')");
    expect(ctrl).not.toMatch(/@(Put|Delete)\(/);
  });

  it('documents freezes and task records including P3 patch', () => {
    expect(
      read('docs/engineering/database-freeze/DBF-002-student-registry-list-slice.md'),
    ).toContain('1.2');
    const acf = read('docs/engineering/api-contract-freeze/ACF-002-student-registry-list-slice.md');
    expect(acf).toContain('listStudents');
    expect(acf).toContain('getStudent');
    expect(acf).toContain('createStudent');
    expect(acf).toContain('patchStudent');
    expect(acf).toContain('1.3');
    expect(read('docs/engineering/task-records/IMP-002-P0-students-list-read.md')).toContain(
      'IMP-002-P0',
    );
    expect(read('docs/engineering/task-records/IMP-002-P1-students-get-by-id.md')).toContain(
      'IMP-002-P1',
    );
    expect(read('docs/engineering/task-records/IMP-002-P2-students-create.md')).toContain(
      'IMP-002-P2',
    );
    expect(read('docs/engineering/task-records/IMP-002-P3-students-patch.md')).toContain(
      'IMP-002-P3',
    );
  });

  it('includes student.read and student.manage; update helper migration', () => {
    const codes = read('apps/api/src/common/policy/permission-codes.ts');
    expect(codes).toContain("'student.read'");
    expect(codes).toContain("'student.manage'");
    const roles = read('apps/api/src/modules/identity-and-access/rbac/system-roles.ts');
    expect(roles).toContain("'student.read'");
    expect(roles).toMatch(/STAFF_PERMISSIONS[\s\S]*'student\.read'/);
    const up = read('apps/api/db/migrations/20260720220000_students_update.up.sql');
    expect(up).toContain('app.update_student');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('GRANT EXECUTE');
  });
});
