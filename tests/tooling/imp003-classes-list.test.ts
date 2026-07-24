import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003-C0/C1/C2 classes list + detail + create structural', () => {
  it('registers GET list/detail + POST create + PATCH with permissions and no put/delete', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/classes.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/classes')");
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

  it('wires Classes* in academic-structure module', () => {
    const mod = read('apps/api/src/modules/academic-structure/academic-structure.module.ts');
    expect(mod).toContain('ClassesController');
    expect(mod).toContain('ClassesService');
    expect(mod).toContain('ClassesRepository');
  });

  it('documents freezes and task records', () => {
    expect(read('docs/engineering/database-freeze/DBF-005-classes-list-slice.md')).toContain(
      'create_class',
    );
    const acf = read('docs/engineering/api-contract-freeze/ACF-005-classes-list-slice.md');
    expect(acf).toContain('listClasses');
    expect(acf).toContain('getClass');
    expect(acf).toContain('createClass');
    expect(acf).toContain('1.2');
    expect(read('docs/engineering/task-records/IMP-003-C0-classes-list-read.md')).toContain(
      'IMP-003-C0',
    );
    expect(read('docs/engineering/task-records/IMP-003-C1-classes-get-by-id.md')).toContain(
      'IMP-003-C1',
    );
    expect(read('docs/engineering/task-records/IMP-003-C2-classes-create.md')).toContain(
      'IMP-003-C2',
    );
  });

  it('list migration SELECT-only; create helper present', () => {
    const up = read('apps/api/db/migrations/20260720230000_classes_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE classes/i);
    expect(up).toContain('GRANT SELECT ON TABLE classes TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE classes FROM educore_app');
    const createUp = read('apps/api/db/migrations/20260720240000_classes_create.up.sql');
    expect(createUp).toContain('app.create_class');
    expect(createUp).toMatch(/SECURITY DEFINER/i);
    expect(createUp).toContain('parent academic year not found');
  });
});
