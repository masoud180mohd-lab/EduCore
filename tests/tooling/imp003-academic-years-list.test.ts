import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003 academic years list + detail + create structural', () => {
  it('registers GET list/detail + POST create with permissions and no patch/delete', () => {
    const ctrl = read(
      'apps/api/src/modules/academic-structure/controllers/academic-years.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/academic-years')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).toContain("RequirePermission('academic.manage')");
    expect(ctrl).not.toMatch(/@(Put|Patch|Delete)\(/);
  });

  it('documents freezes and task records', () => {
    expect(read('docs/engineering/database-freeze/DBF-003-academic-years-list-slice.md')).toContain(
      'DBF-003',
    );
    const acf = read('docs/engineering/api-contract-freeze/ACF-003-academic-years-list-slice.md');
    expect(acf).toContain('listAcademicYears');
    expect(acf).toContain('getAcademicYear');
    expect(acf).toContain('createAcademicYear');
    expect(acf).toContain('1.2');
    expect(read('docs/engineering/task-records/IMP-003-P0-academic-years-list-read.md')).toContain(
      'IMP-003-P0',
    );
    expect(read('docs/engineering/task-records/IMP-003-P1-academic-years-get-by-id.md')).toContain(
      'IMP-003-P1',
    );
    expect(read('docs/engineering/task-records/IMP-003-P2-academic-years-create.md')).toContain(
      'IMP-003-P2',
    );
  });

  it('includes academic.read and academic.manage; staff read-only for manage', () => {
    const codes = read('apps/api/src/common/policy/permission-codes.ts');
    expect(codes).toContain("'academic.read'");
    expect(codes).toContain("'academic.manage'");
    const roles = read('apps/api/src/modules/identity-and-access/rbac/system-roles.ts');
    expect(roles).toMatch(/STAFF_PERMISSIONS[\s\S]*'academic\.read'/);
  });

  it('migration list SELECT-only; create helper + academic.manage', () => {
    const listUp = read('apps/api/db/migrations/20260720180000_academic_years_list_read.up.sql');
    expect(listUp).toMatch(/CREATE TABLE academic_years/i);
    expect(listUp).toContain('GRANT SELECT ON TABLE academic_years TO educore_app');
    expect(listUp).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE academic_years FROM educore_app',
    );
    const createUp = read('apps/api/db/migrations/20260720190000_academic_years_create.up.sql');
    expect(createUp).toContain('app.create_academic_year');
    expect(createUp).toContain('academic.manage');
    expect(createUp).toMatch(/SECURITY DEFINER/i);
  });
});
