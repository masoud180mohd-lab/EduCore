import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-013 academic structure PATCH', () => {
  it('ACF-003…007 rev 1.3 document PATCH', () => {
    for (const rel of [
      'ACF-003-academic-years-list-slice.md',
      'ACF-004-terms-list-slice.md',
      'ACF-005-classes-list-slice.md',
      'ACF-006-streams-list-slice.md',
      'ACF-007-subjects-list-slice.md',
    ]) {
      const md = readFileSync(path.join(root, 'docs/engineering/api-contract-freeze', rel), 'utf8');
      expect(md, rel).toMatch(/1\.3/);
      expect(md, rel).toMatch(/PATCH|patch/);
    }
  });

  it('OpenAPI has patch ops for five structure entities', () => {
    const doc = load(
      readFileSync(
        path.join(
          root,
          'docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml',
        ),
        'utf8',
      ),
    ) as {
      paths?: Record<string, Record<string, { operationId?: string }>>;
    };
    const expected: ReadonlyArray<[string, string]> = [
      ['/academic-years/{academicYearId}', 'patchAcademicYear'],
      ['/terms/{termId}', 'patchTerm'],
      ['/classes/{classId}', 'patchClass'],
      ['/streams/{streamId}', 'patchStream'],
      ['/subjects/{subjectId}', 'patchSubject'],
    ];
    for (const [pathKey, id] of expected) {
      expect(doc.paths?.[pathKey]?.['patch']?.operationId, pathKey).toBe(id);
    }
  });

  it('DSF-002 documents editable academic detail', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:[2-9]|10|11|12|13|14|15|16|17|18|19|20)/);
    expect(dsf).toContain('IMP-013');
    expect(dsf).toMatch(/edit detail|edit forms/i);
  });

  it('migration ships update helpers', () => {
    const up = path.join(
      root,
      'apps/api/db/migrations/20260724180000_academic_structure_update_helpers.up.sql',
    );
    expect(existsSync(up)).toBe(true);
    const sql = readFileSync(up, 'utf8');
    for (const fn of [
      'update_academic_year',
      'update_term',
      'update_class',
      'update_stream',
      'update_subject',
    ]) {
      expect(sql).toContain(`app.${fn}`);
    }
  });

  it('Admin detail pages PATCH with closed confirm', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/academic');
    for (const [segment, param] of [
      ['years', '[yearId]'],
      ['terms', '[termId]'],
      ['classes', '[classId]'],
      ['streams', '[streamId]'],
      ['subjects', '[subjectId]'],
    ] as const) {
      const page = readFileSync(path.join(base, segment, param, 'page.tsx'), 'utf8');
      expect(page, segment).toContain("method: 'PATCH'");
      expect(page, segment).toContain('closed');
      expect(page, segment).toContain('confirm');
    }
  });

  it('has task record and manual QA checklist', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-013-academic-structure-patch.md'),
      ),
    ).toBe(true);
    expect(
      existsSync(path.join(root, 'tasks/manual-test-admin-academic-structure-patch-qa.md')),
    ).toBe(true);
  });
});
