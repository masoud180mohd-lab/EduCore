import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003 academic years list structural', () => {
  it('registers GET list with academic.read and no writes', () => {
    const ctrl = read(
      'apps/api/src/modules/academic-structure/controllers/academic-years.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/academic-years')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });

  it('documents freezes and task record', () => {
    expect(read('docs/engineering/database-freeze/DBF-003-academic-years-list-slice.md')).toContain(
      'DBF-003',
    );
    const acf = read('docs/engineering/api-contract-freeze/ACF-003-academic-years-list-slice.md');
    expect(acf).toContain('listAcademicYears');
    expect(acf).toContain('starts_on DESC NULLS LAST');
    expect(read('docs/engineering/task-records/IMP-003-P0-academic-years-list-read.md')).toContain(
      'IMP-003-P0',
    );
  });

  it('includes academic.read in permission codes and staff matrix', () => {
    const codes = read('apps/api/src/common/policy/permission-codes.ts');
    expect(codes).toContain("'academic.read'");
    const roles = read('apps/api/src/modules/identity-and-access/rbac/system-roles.ts');
    expect(roles).toMatch(/STAFF_PERMISSIONS[\s\S]*'academic\.read'/);
  });

  it('migration is SELECT-only for educore_app', () => {
    const up = read('apps/api/db/migrations/20260720180000_academic_years_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE academic_years/i);
    expect(up).toContain('academic.read');
    expect(up).toContain('GRANT SELECT ON TABLE academic_years TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE academic_years FROM educore_app');
  });
});
