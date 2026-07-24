import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml',
);

type Op = {
  'parameters'?: { name?: string; $ref?: string }[];
  'x-authz'?: { stack?: string[]; permissionCodes?: string[] };
  'operationId'?: string;
};

function loadDoc(): {
  openapi?: string;
  servers?: { url?: string }[];
  paths?: Record<string, Record<string, Op>>;
} {
  return load(readFileSync(openApiPath, 'utf8')) as ReturnType<typeof loadDoc>;
}

function op(pathKey: string, method: string): Op {
  const found = loadDoc().paths?.[pathKey]?.[method];
  if (found === undefined) throw new Error(`missing ${method.toUpperCase()} ${pathKey}`);
  return found;
}

function authzStack(pathKey: string, method: string): string[] {
  return op(pathKey, method)['x-authz']?.stack ?? [];
}

function paramNames(pathKey: string, method: string): string[] {
  return (op(pathKey, method).parameters ?? []).map((p) => {
    if (typeof p.name === 'string') return p.name;
    const ref = p.$ref ?? '';
    if (ref.endsWith('/Limit')) return 'limit';
    if (ref.endsWith('/Cursor')) return 'cursor';
    if (ref.endsWith('/TenantIdHeader')) return 'X-Tenant-Id';
    if (ref.includes('Idempotency')) return 'Idempotency-Key';
    if (ref.endsWith('/StudentId')) return 'studentId';
    if (ref.endsWith('/AcademicYearId')) return 'academicYearId';
    if (ref.endsWith('/TermId')) return 'termId';
    if (ref.endsWith('/ClassId')) return 'classId';
    if (ref.endsWith('/StreamId')) return 'streamId';
    if (ref.endsWith('/SubjectId')) return 'subjectId';
    return ref;
  });
}

describe('ASSURE-001 OpenAPI students+academic sync', () => {
  it('loads OpenAPI 3.1 with /api/v1 server', () => {
    const doc = loadDoc();
    expect(String(doc.openapi).startsWith('3.1')).toBe(true);
    expect(doc.servers?.[0]?.url).toBe('/api/v1');
  });

  it('documents student list/get/create/patch operationIds and filters', () => {
    expect(op('/students', 'get').operationId).toBe('listStudents');
    expect(op('/students', 'post').operationId).toBe('createStudent');
    expect(op('/students/{studentId}', 'get').operationId).toBe('getStudent');
    expect(op('/students/{studentId}', 'patch').operationId).toBe('patchStudent');
    expect(paramNames('/students', 'get')).toEqual(
      expect.arrayContaining(['limit', 'cursor', 'status', 'search']),
    );
    expect(paramNames('/students', 'post')).toContain('Idempotency-Key');
  });

  it('documents academic-years/terms/classes/streams/subjects operations', () => {
    const expected: ReadonlyArray<[string, string, string]> = [
      ['/academic-years', 'get', 'listAcademicYears'],
      ['/academic-years', 'post', 'createAcademicYear'],
      ['/academic-years/{academicYearId}', 'get', 'getAcademicYear'],
      ['/academic-years/{academicYearId}', 'patch', 'patchAcademicYear'],
      ['/academic-years/{academicYearId}', 'delete', 'deleteAcademicYear'],
      ['/terms', 'get', 'listTerms'],
      ['/terms', 'post', 'createTerm'],
      ['/terms/{termId}', 'get', 'getTerm'],
      ['/terms/{termId}', 'patch', 'patchTerm'],
      ['/terms/{termId}', 'delete', 'deleteTerm'],
      ['/classes', 'get', 'listClasses'],
      ['/classes', 'post', 'createClass'],
      ['/classes/{classId}', 'get', 'getClass'],
      ['/classes/{classId}', 'patch', 'patchClass'],
      ['/classes/{classId}', 'delete', 'deleteClass'],
      ['/streams', 'get', 'listStreams'],
      ['/streams', 'post', 'createStream'],
      ['/streams/{streamId}', 'get', 'getStream'],
      ['/streams/{streamId}', 'patch', 'patchStream'],
      ['/streams/{streamId}', 'delete', 'deleteStream'],
      ['/subjects', 'get', 'listSubjects'],
      ['/subjects', 'post', 'createSubject'],
      ['/subjects/{subjectId}', 'get', 'getSubject'],
      ['/subjects/{subjectId}', 'patch', 'patchSubject'],
      ['/subjects/{subjectId}', 'delete', 'deleteSubject'],
    ];
    for (const [pathKey, method, id] of expected) {
      expect(op(pathKey, method).operationId, `${method} ${pathKey}`).toBe(id);
    }
    expect(paramNames('/classes', 'get')).toEqual(
      expect.arrayContaining(['academicYearId', 'termId', 'status', 'search']),
    );
    expect(paramNames('/terms', 'get')).toContain('academicYearId');
    expect(paramNames('/streams', 'get')).toContain('classId');
  });

  it('includes session_tenant_bind on privileged routes', () => {
    const privileged: ReadonlyArray<[string, string]> = [
      ['/students', 'get'],
      ['/students', 'post'],
      ['/students/{studentId}', 'get'],
      ['/students/{studentId}', 'patch'],
      ['/academic-years', 'get'],
      ['/academic-years', 'post'],
      ['/classes', 'get'],
      ['/classes', 'post'],
      ['/subjects/{subjectId}', 'get'],
    ];
    for (const [pathKey, method] of privileged) {
      expect(authzStack(pathKey, method), `${pathKey} ${method}`).toContain('session_tenant_bind');
    }
  });

  it('does not invent DELETE on students; academic structure DELETE is documented (IMP-014)', () => {
    const doc = loadDoc();
    for (const pathKey of Object.keys(doc.paths ?? {})) {
      if (pathKey.startsWith('/students')) {
        expect(doc.paths?.[pathKey], pathKey).not.toHaveProperty('delete');
      }
    }
    expect(doc.paths?.['/academic-years/{academicYearId}']).toHaveProperty('delete');
    expect(doc.paths?.['/subjects/{subjectId}']).toHaveProperty('delete');
  });

  it('is linked from ACF README and ACF-002…007 markdown', () => {
    const readme = readFileSync(
      path.join(projectRoot, 'docs/engineering/api-contract-freeze/README.md'),
      'utf8',
    );
    expect(readme).toContain('acf-002-007-students-academic.openapi.yaml');
    for (const rel of [
      'ACF-002-student-registry-list-slice.md',
      'ACF-003-academic-years-list-slice.md',
      'ACF-004-terms-list-slice.md',
      'ACF-005-classes-list-slice.md',
      'ACF-006-streams-list-slice.md',
      'ACF-007-subjects-list-slice.md',
    ]) {
      const md = readFileSync(
        path.join(projectRoot, 'docs/engineering/api-contract-freeze', rel),
        'utf8',
      );
      expect(md, rel).toContain('acf-002-007-students-academic.openapi.yaml');
    }
  });
});
