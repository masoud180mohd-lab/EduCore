import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-008-009-enrollments-attendance.openapi.yaml',
);

function loadDoc(): {
  paths?: Record<
    string,
    Record<
      string,
      {
        'parameters'?: { name: string; $ref?: string }[];
        'x-authz'?: { stack?: string[]; permissionCodes?: string[] };
        'x-permissions'?: string[];
      }
    >
  >;
} {
  return load(readFileSync(openApiPath, 'utf8')) as ReturnType<typeof loadDoc>;
}

function authzStack(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.stack ?? [];
}

function permissionCodes(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.permissionCodes ?? [];
}

function paramNames(pathKey: string, method: string): string[] {
  const params = loadDoc().paths?.[pathKey]?.[method]?.parameters ?? [];
  return params.map((p) => {
    if (typeof p.name === 'string') return p.name;
    const ref = p.$ref ?? '';
    if (ref.endsWith('/Limit')) return 'limit';
    if (ref.endsWith('/Cursor')) return 'cursor';
    if (ref.endsWith('/TenantIdHeader')) return 'X-Tenant-Id';
    if (ref.endsWith('/IdempotencyKeyRequired') || ref.endsWith('/IdempotencyKeyOptional')) {
      return 'Idempotency-Key';
    }
    if (ref.endsWith('/EnrollmentId')) return 'enrollmentId';
    if (ref.endsWith('/AttendanceSessionId')) return 'sessionId';
    return ref;
  });
}

describe('IMP-OPENAPI enrollments+attendance sync (AUDIT-R5 High)', () => {
  it('loads ACF-008/009 OpenAPI document', () => {
    const doc = loadDoc();
    expect(doc.paths).toBeTypeOf('object');
  });

  it('documents enrollment list filters and session_tenant_bind', () => {
    const names = paramNames('/enrollments', 'get');
    expect(names).toEqual(
      expect.arrayContaining(['X-Tenant-Id', 'limit', 'cursor', 'studentId', 'classId', 'status']),
    );
    expect(authzStack('/enrollments', 'get')).toContain('session_tenant_bind');
    expect(permissionCodes('/enrollments', 'get')).toContain('academic.read');
  });

  it('requires Idempotency-Key on enrollment create and attendance create/records', () => {
    expect(paramNames('/enrollments', 'post')).toContain('Idempotency-Key');
    expect(paramNames('/attendance-sessions', 'post')).toContain('Idempotency-Key');
    expect(paramNames('/attendance-sessions/{sessionId}/records', 'put')).toContain(
      'Idempotency-Key',
    );
  });

  it('documents attendance list filters and manage permissions on writes', () => {
    const names = paramNames('/attendance-sessions', 'get');
    expect(names).toEqual(
      expect.arrayContaining(['classId', 'sessionDate', 'status', 'limit', 'cursor']),
    );
    expect(permissionCodes('/attendance-sessions', 'post')).toContain('attendance.manage');
    expect(permissionCodes('/attendance-sessions/{sessionId}/close', 'post')).toContain(
      'attendance.manage',
    );
    expect(authzStack('/attendance-sessions/{sessionId}', 'get')).toContain('session_tenant_bind');
  });

  it('covers all ACF-008/009 implemented paths', () => {
    const paths = Object.keys(loadDoc().paths ?? {});
    for (const p of [
      '/enrollments',
      '/enrollments/{enrollmentId}',
      '/attendance-sessions',
      '/attendance-sessions/{sessionId}',
      '/attendance-sessions/{sessionId}/close',
      '/attendance-sessions/{sessionId}/records',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
  });
});
