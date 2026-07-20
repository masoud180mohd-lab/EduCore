import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml',
);

function readOpenApi(): string {
  return readFileSync(openApiPath, 'utf8');
}

function loadDoc(): {
  paths?: Record<
    string,
    Record<string, { 'parameters'?: { name: string }[]; 'x-authz'?: { stack?: string[] } }>
  >;
} {
  return load(readOpenApi()) as {
    paths?: Record<
      string,
      Record<string, { 'parameters'?: { name: string }[]; 'x-authz'?: { stack?: string[] } }>
    >;
  };
}

function paramNames(pathKey: string, method: string): string[] {
  const doc = loadDoc();
  const op = doc.paths?.[pathKey]?.[method];
  return (op?.parameters ?? []).map((p) => p.name);
}

function authzStack(pathKey: string, method: string): string[] {
  const doc = loadDoc();
  return doc.paths?.[pathKey]?.[method]?.['x-authz']?.stack ?? [];
}

describe('IMP-001 P10b OpenAPI read sync (AUDIT-R4 High)', () => {
  it('documents P8 org list filters orgType and search', () => {
    const names = paramNames('/organizations', 'get');
    expect(names).toContain('orgType');
    expect(names).toContain('search');
  });

  it('documents P8 users list search filter', () => {
    const names = paramNames('/users', 'get');
    expect(names).toContain('search');
  });

  it('documents P8 memberships list userId filter', () => {
    const names = paramNames('/memberships', 'get');
    expect(names).toContain('userId');
  });

  it('includes session_tenant_bind on privileged product GET x-authz stacks', () => {
    const privilegedGets: ReadonlyArray<[string, string]> = [
      ['/tenants/current', 'get'],
      ['/organizations', 'get'],
      ['/organizations/{organizationId}', 'get'],
      ['/tenant-settings', 'get'],
      ['/users', 'get'],
      ['/memberships', 'get'],
      ['/memberships/{membershipId}', 'get'],
    ];

    for (const [pathKey, method] of privilegedGets) {
      expect(authzStack(pathKey, method), `${pathKey} ${method}`).toContain('session_tenant_bind');
    }
  });

  it('keeps listAccessibleTenants without session_tenant_bind (picker exception)', () => {
    expect(authzStack('/tenants', 'get')).not.toContain('session_tenant_bind');
  });

  it('documents P10 task record', () => {
    const record = readFileSync(
      path.join(projectRoot, 'docs/engineering/task-records/IMP-001-P10-live-read-isolation.md'),
      'utf8',
    );
    expect(record).toMatch(/HTTP integration|OpenAPI|live/i);
  });
});
