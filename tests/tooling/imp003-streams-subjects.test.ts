import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-003 streams + subjects structural', () => {
  it('registers streams list/detail/create/patch without put/delete', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/streams.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/streams')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("RequirePermission('academic.read')");
    expect(ctrl).toContain("RequirePermission('academic.manage')");
    expect(ctrl).not.toMatch(/@(Put|Delete)\(/);
  });

  it('registers subjects list/detail/create/patch without put/delete', () => {
    const ctrl = read('apps/api/src/modules/academic-structure/controllers/subjects.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/subjects')");
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).not.toMatch(/@(Put|Delete)\(/);
  });

  it('documents freezes', () => {
    expect(read('docs/engineering/database-freeze/DBF-006-streams-list-slice.md')).toContain(
      'DBF-006',
    );
    expect(read('docs/engineering/api-contract-freeze/ACF-006-streams-list-slice.md')).toContain(
      'streams',
    );
    expect(read('docs/engineering/database-freeze/DBF-007-subjects-list-slice.md')).toContain(
      'DBF-007',
    );
    expect(read('docs/engineering/api-contract-freeze/ACF-007-subjects-list-slice.md')).toContain(
      'subjects',
    );
  });

  it('migrations SELECT-only + create helpers', () => {
    const sList = read('apps/api/db/migrations/20260720250000_streams_list_read.up.sql');
    expect(sList).toMatch(/CREATE TABLE streams/i);
    expect(sList).toContain('GRANT SELECT ON TABLE streams TO educore_app');
    const sCreate = read('apps/api/db/migrations/20260720260000_streams_create.up.sql');
    expect(sCreate).toContain('app.create_stream');
    const jList = read('apps/api/db/migrations/20260720270000_subjects_list_read.up.sql');
    expect(jList).toMatch(/CREATE TABLE subjects/i);
    const jCreate = read('apps/api/db/migrations/20260720280000_subjects_create.up.sql');
    expect(jCreate).toContain('app.create_subject');
  });
});
