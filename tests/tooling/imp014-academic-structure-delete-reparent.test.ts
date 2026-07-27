import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-014 academic structure DELETE + reparent', () => {
  it('ACF-003…007 rev 1.4 document DELETE', () => {
    for (const rel of [
      'ACF-003-academic-years-list-slice.md',
      'ACF-004-terms-list-slice.md',
      'ACF-005-classes-list-slice.md',
      'ACF-006-streams-list-slice.md',
      'ACF-007-subjects-list-slice.md',
    ]) {
      const md = readFileSync(path.join(root, 'docs/engineering/api-contract-freeze', rel), 'utf8');
      expect(md, rel).toMatch(/1\.4/);
      expect(md, rel).toMatch(/DELETE|delete/);
    }
  });

  it('OpenAPI has delete ops and reparent patch fields', () => {
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
      components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
    };
    const expected: ReadonlyArray<[string, string]> = [
      ['/academic-years/{academicYearId}', 'deleteAcademicYear'],
      ['/terms/{termId}', 'deleteTerm'],
      ['/classes/{classId}', 'deleteClass'],
      ['/streams/{streamId}', 'deleteStream'],
      ['/subjects/{subjectId}', 'deleteSubject'],
    ];
    for (const [pathKey, id] of expected) {
      expect(doc.paths?.[pathKey]?.['delete']?.operationId, pathKey).toBe(id);
    }
    expect(doc.components?.schemas?.['PatchTermRequest']?.properties).toHaveProperty(
      'academicYearId',
    );
    expect(doc.components?.schemas?.['PatchClassRequest']?.properties).toHaveProperty(
      'academicYearId',
    );
    expect(doc.components?.schemas?.['PatchClassRequest']?.properties).toHaveProperty('termId');
    expect(doc.components?.schemas?.['PatchStreamRequest']?.properties).toHaveProperty('classId');
  });

  it('DSF-002 documents delete and reparent', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:[3-9]|10|11|12|13)/);
    expect(dsf).toContain('IMP-014');
    expect(dsf).toMatch(/[Dd]elete/);
    expect(dsf).toMatch(/[Rr]eparent/);
  });

  it('migration ships delete helpers and reparent update signatures', () => {
    const up = path.join(
      root,
      'apps/api/db/migrations/20260725010000_academic_structure_delete_reparent.up.sql',
    );
    expect(existsSync(up)).toBe(true);
    const sql = readFileSync(up, 'utf8');
    for (const fn of [
      'delete_academic_year',
      'delete_term',
      'delete_class',
      'delete_stream',
      'delete_subject',
    ]) {
      expect(sql).toContain(`app.${fn}`);
    }
    expect(sql).toContain('p_set_academic_year_id');
    expect(sql).toContain('p_set_class_id');
    expect(sql).toContain('has dependents');
  });

  it('Admin detail pages DELETE; term/class/stream reparent fields', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/academic');
    for (const [segment, param] of [
      ['years', '[yearId]'],
      ['terms', '[termId]'],
      ['classes', '[classId]'],
      ['streams', '[streamId]'],
      ['subjects', '[subjectId]'],
    ] as const) {
      const page = readFileSync(path.join(base, segment, param, 'page.tsx'), 'utf8');
      expect(page, segment).toContain("method: 'DELETE'");
      expect(page, segment).toContain('confirm');
    }
    const term = readFileSync(path.join(base, 'terms', '[termId]', 'page.tsx'), 'utf8');
    expect(term).toContain('academicYearId');
    const klass = readFileSync(path.join(base, 'classes', '[classId]', 'page.tsx'), 'utf8');
    expect(klass).toContain('academicYearId');
    expect(klass).toContain('termId');
    const stream = readFileSync(path.join(base, 'streams', '[streamId]', 'page.tsx'), 'utf8');
    expect(stream).toContain('classId');
  });

  it('has task record and manual QA checklist', () => {
    expect(
      existsSync(
        path.join(
          root,
          'docs/engineering/task-records/IMP-014-academic-structure-delete-reparent.md',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'tasks/manual-test-admin-academic-structure-delete-reparent-qa.md'),
      ),
    ).toBe(true);
  });
});
