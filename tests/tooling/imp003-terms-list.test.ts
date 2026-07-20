import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003-P3 terms list structural', () => {
  it('registers GET list with academic.read and no write verbs', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/terms.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/terms')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
    expect(ctrl).not.toContain('term.read');
  });

  it('wires TermsController/Service/Repository in academic-structure module', () => {
    const mod = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(mod).toContain('TermsController');
    expect(mod).toContain('TermsService');
    expect(mod).toContain('TermsRepository');
  });

  it('documents freezes and task record; reuses academic.read only', () => {
    const dbf = read('docs/engineering/database-freeze/DBF-004-terms-list-slice.md');
    expect(dbf).toContain('DBF-004');
    expect(dbf).toContain('terms');
    expect(dbf).toContain('academic.read');
    expect(dbf).toMatch(/No new permission|no new permission/i);

    const acf = read('docs/engineering/api-contract-freeze/ACF-004-terms-list-slice.md');
    expect(acf).toContain('listTerms');
    expect(acf).toContain('/api/v1/terms');
    expect(acf).toContain('academicYearId');
    expect(acf).toContain('starts_on ASC NULLS LAST');

    expect(read('docs/engineering/task-records/IMP-003-P3-terms-list-read.md')).toContain(
      'IMP-003-P3',
    );
  });

  it('migration SELECT-only; no new permission seed; parent FK to academic_years', () => {
    const up = read('apps/api/db/migrations/20260720200000_terms_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE terms/i);
    expect(up).toContain('REFERENCES academic_years (id)');
    expect(up).toContain('GRANT SELECT ON TABLE terms TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE terms FROM educore_app');
    expect(up).not.toMatch(/INSERT INTO permissions/i);
    expect(up).not.toContain('term.read');
    const down = read('apps/api/db/migrations/20260720200000_terms_list_read.down.sql');
    expect(down).toContain('DROP TABLE IF EXISTS terms');
  });
});
