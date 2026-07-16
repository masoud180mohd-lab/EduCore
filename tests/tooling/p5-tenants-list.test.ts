import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-001 product tenants reads — list + current + get by id', () => {
  it('registers list, current (before :id), and get-by-id without writes', () => {
    const ctrl = read('apps/api/src/modules/tenant-and-billing/controllers/tenants.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/tenants')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain("@Get('current')");
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl.indexOf("@Get('current')")).toBeLessThan(ctrl.indexOf("@Get(':id')"));
    expect(ctrl).toContain('RequireAuthGuard');
    expect(ctrl).toContain("RequirePermission('tenant.read')");
    expect(ctrl).toContain('getCurrent');
    expect(ctrl).toContain('TENANT_PATH_MISMATCH');
    expect(ctrl).toContain('getForUser');
    expect(ctrl).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });

  it('scopes list and get to active membership via RLS user context', () => {
    const repo = read(
      'apps/api/src/modules/tenant-and-billing/repositories/accessible-tenants.repository.ts',
    );
    expect(repo).toContain('withUserRlsTransaction');
    expect(repo).toContain('FROM tenants');
    expect(repo).toContain('listAccessibleTenants');
    expect(repo).toContain('getAccessibleTenantById');
    expect(repo).toContain('logFailClosedDbError');
  });

  it('OpenAPI documents list + membership-scoped get AuthZ', () => {
    const openapi = read(
      'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml',
    );
    expect(openapi).toContain('operationId: listAccessibleTenants');
    expect(openapi).toContain('TenantListEnvelope');
    expect(openapi).toContain('session_tenant_bind');
    expect(openapi).toMatch(/operationId: getTenant[\s\S]*tenant\.read/);
  });

  it('maps inaccessible get to NOT_FOUND (no existence leak)', () => {
    const service = read('apps/api/src/modules/tenant-and-billing/application/tenants.service.ts');
    expect(service).toContain('getForUser');
    expect(service).toContain("notFound('Tenant not found.')");
  });

  it('keeps placeholder controller free of write routes', () => {
    const placeholder = read(
      'apps/api/src/modules/tenant-and-billing/controllers/tenant-and-billing.controller.ts',
    );
    expect(placeholder).not.toMatch(/@(Post|Put|Patch|Delete)\(/);
  });

  it('documents the task records', () => {
    const listRecord = read('docs/engineering/task-records/IMP-001-P5-tenants-list-read.md');
    const getRecord = read('docs/engineering/task-records/IMP-001-P5b-tenants-get-by-id.md');
    const currentRecord = read('docs/engineering/task-records/IMP-001-P5c-tenants-current.md');
    const p5d = read('docs/engineering/task-records/IMP-001-P5d-tenants-warn-log-openapi.md');
    expect(listRecord).toMatch(/GET \/api\/v1\/tenants/i);
    expect(getRecord).toMatch(/GET \/api\/v1\/tenants\/\{id\}/i);
    expect(currentRecord).toMatch(/GET \/api\/v1\/tenants\/current/i);
    expect(p5d).toMatch(/logFailClosedDbError|OpenAPI/i);
  });
});
