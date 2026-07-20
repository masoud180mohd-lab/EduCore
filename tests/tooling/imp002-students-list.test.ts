import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-002 students list + detail + create structural', () => {
  it('registers GET list/detail + POST create with permissions and no patch/delete', () => {
    const ctrl = read('apps/api/src/modules/student-registry/controllers/students.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/students')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("RequirePermission('student.read')");
    expect(ctrl).toContain("RequirePermission('student.manage')");
    expect(ctrl).not.toMatch(/@(Put|Patch|Delete)\(/);
  });

  it('documents freezes and task records', () => {
    expect(
      read('docs/engineering/database-freeze/DBF-002-student-registry-list-slice.md'),
    ).toContain('DBF-002');
    const acf = read('docs/engineering/api-contract-freeze/ACF-002-student-registry-list-slice.md');
    expect(acf).toContain('listStudents');
    expect(acf).toContain('getStudent');
    expect(acf).toContain('createStudent');
    expect(acf).toContain('1.2');
    expect(read('docs/engineering/task-records/IMP-002-P0-students-list-read.md')).toContain(
      'IMP-002-P0',
    );
    expect(read('docs/engineering/task-records/IMP-002-P1-students-get-by-id.md')).toContain(
      'IMP-002-P1',
    );
    expect(read('docs/engineering/task-records/IMP-002-P2-students-create.md')).toContain(
      'IMP-002-P2',
    );
  });

  it('includes student.read and student.manage in permission codes', () => {
    const codes = read('apps/api/src/common/policy/permission-codes.ts');
    expect(codes).toContain("'student.read'");
    expect(codes).toContain("'student.manage'");
    const roles = read('apps/api/src/modules/identity-and-access/rbac/system-roles.ts');
    expect(roles).toContain("'student.read'");
    // staff remains read-oriented (no manage in STAFF_PERMISSIONS list)
    expect(roles).toMatch(/STAFF_PERMISSIONS[\s\S]*'student\.read'/);
  });
});
