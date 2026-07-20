import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003-C0 classes list structural', () => {
  it('registers GET list with academic.read and no write verbs', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/classes.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/classes')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });

  it('wires Classes* in academic-structure module', () => {
    const mod = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(mod).toContain('ClassesController');
    expect(mod).toContain('ClassesService');
    expect(mod).toContain('ClassesRepository');
  });

  it('documents freezes and task record', () => {
    expect(read('docs/engineering/database-freeze/DBF-005-classes-list-slice.md')).toContain(
      'DBF-005',
    );
    expect(read('docs/engineering/api-contract-freeze/ACF-005-classes-list-slice.md')).toContain(
      'listClasses',
    );
    expect(read('docs/engineering/task-records/IMP-003-C0-classes-list-read.md')).toContain(
      'IMP-003-C0',
    );
  });

  it('migration SELECT-only with parent FKs', () => {
    const up = read('apps/api/db/migrations/20260720230000_classes_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE classes/i);
    expect(up).toContain('REFERENCES academic_years (id)');
    expect(up).toContain('REFERENCES terms (id)');
    expect(up).toContain('GRANT SELECT ON TABLE classes TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE classes FROM educore_app');
  });
});
