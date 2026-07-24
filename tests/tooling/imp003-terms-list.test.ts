import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003-P3/P4/P5 terms list + detail + create structural', () => {
  it('registers GET list/detail + POST create + PATCH + DELETE with permissions and no put', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/terms.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/terms')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("@Delete(':id')");
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).toContain("RequirePermission('academic.manage')");
    expect(ctrl).not.toMatch(/@Put\(/);
    expect(ctrl).not.toContain('term.read');
    expect(ctrl).not.toContain('term.manage');
    // Route order: list Get, Post, then :id Get.
    const listAt = ctrl.indexOf('@Get()');
    const postAt = ctrl.indexOf('@Post()');
    const detailAt = ctrl.indexOf("@Get(':id')");
    expect(listAt).toBeLessThan(postAt);
    expect(postAt).toBeLessThan(detailAt);
  });

  it('wires TermsController/Service/Repository in academic-structure module', () => {
    const mod = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(mod).toContain('TermsController');
    expect(mod).toContain('TermsService');
    expect(mod).toContain('TermsRepository');
  });

  it('documents freezes and task records; reuses academic.read/manage only', () => {
    const dbf = read('docs/engineering/database-freeze/DBF-004-terms-list-slice.md');
    expect(dbf).toContain('DBF-004');
    expect(dbf).toContain('1.1');
    expect(dbf).toContain('app.create_term');
    expect(dbf).toContain('academic.manage');

    const acf = read('docs/engineering/api-contract-freeze/ACF-004-terms-list-slice.md');
    expect(acf).toContain('listTerms');
    expect(acf).toContain('getTerm');
    expect(acf).toContain('createTerm');
    expect(acf).toContain('1.2');
    expect(acf).toContain('academicYearId not found in this tenant');

    expect(read('docs/engineering/task-records/IMP-003-P3-terms-list-read.md')).toContain(
      'IMP-003-P3',
    );
    expect(read('docs/engineering/task-records/IMP-003-P4-terms-get-by-id.md')).toContain(
      'IMP-003-P4',
    );
    expect(read('docs/engineering/task-records/IMP-003-P5-terms-create.md')).toContain(
      'IMP-003-P5',
    );
  });

  it('list migration SELECT-only; create helper no new permission seed', () => {
    const listUp = read('apps/api/db/migrations/20260720200000_terms_list_read.up.sql');
    expect(listUp).toMatch(/CREATE TABLE terms/i);
    expect(listUp).toContain('REFERENCES academic_years (id)');
    expect(listUp).toContain('GRANT SELECT ON TABLE terms TO educore_app');
    expect(listUp).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE terms FROM educore_app');
    expect(listUp).not.toMatch(/INSERT INTO permissions/i);

    const createUp = read('apps/api/db/migrations/20260720210000_terms_create.up.sql');
    expect(createUp).toContain('app.create_term');
    expect(createUp).toMatch(/SECURITY DEFINER/i);
    expect(createUp).toContain('parent academic year not found');
    expect(createUp).toContain('GRANT EXECUTE');
    expect(createUp).not.toMatch(/INSERT INTO permissions/i);
    expect(createUp).not.toContain('term.manage');
    const createDown = read('apps/api/db/migrations/20260720210000_terms_create.down.sql');
    expect(createDown).toContain('DROP FUNCTION');
    expect(createDown).not.toContain('DROP TABLE');
  });
});
