import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-010-011-guardians-marks.openapi.yaml',
);

function loadDoc(): {
  paths?: Record<
    string,
    Record<
      string,
      {
        'x-authz'?: { stack?: string[]; permissionCodes?: string[] };
      }
    >
  >;
} {
  return load(readFileSync(openApiPath, 'utf8')) as ReturnType<typeof loadDoc>;
}

function permissionCodes(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.permissionCodes ?? [];
}

function authzStack(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.stack ?? [];
}

describe('IMP-OPENAPI guardians+marks (ACF-010/011 residual)', () => {
  it('loads ACF-010/011 OpenAPI document', () => {
    expect(loadDoc().paths).toBeTypeOf('object');
  });

  it('covers guardian paths with session_tenant_bind', () => {
    const paths = Object.keys(loadDoc().paths ?? {});
    for (const p of [
      '/guardians',
      '/guardians/{guardianId}',
      '/guardians/{guardianId}/links',
      '/guardians/{guardianId}/links/{linkId}/end',
      '/students/{studentId}/guardians',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
    expect(permissionCodes('/guardians', 'get')).toContain('guardian.read');
    expect(permissionCodes('/guardians', 'post')).toContain('guardian.manage');
    expect(authzStack('/guardians/{guardianId}', 'get')).toContain('session_tenant_bind');
  });

  it('covers marks paths including GET exam-subject', () => {
    const paths = Object.keys(loadDoc().paths ?? {});
    for (const p of [
      '/exams',
      '/exams/{examId}',
      '/exams/{examId}/subjects',
      '/exam-subjects/{examSubjectId}',
      '/exam-subjects/{examSubjectId}/marks',
      '/exam-subjects/{examSubjectId}/submit',
      '/exam-subjects/{examSubjectId}/approve',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
    expect(permissionCodes('/exam-subjects/{examSubjectId}', 'get')).toContain('marks.read');
    expect(permissionCodes('/exam-subjects/{examSubjectId}/approve', 'post')).toContain(
      'marks.approve',
    );
  });
});
