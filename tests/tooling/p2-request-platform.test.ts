import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('IMP-001 P2 request platform structure', () => {
  const expectedFiles = [
    'apps/api/src/common/errors/error-envelope.ts',
    'apps/api/src/common/correlation/correlation-id.middleware.ts',
    'apps/api/src/common/tenant/tenant-context.middleware.ts',
    'apps/api/src/common/auth/auth-context.middleware.ts',
    'apps/api/src/common/auth/token-validator.ts',
    'apps/api/src/common/auth/auth.guards.ts',
    'apps/api/src/common/policy/policy-evaluator.ts',
    'apps/api/src/common/policy/permission-codes.ts',
    'apps/api/src/common/idempotency/idempotency.ts',
    'apps/api/src/common/pagination/cursor-pagination.ts',
    'apps/api/src/common/request-platform/request-platform.module.ts',
    'apps/api/src/modules/platform-operations/audit/audit-publisher.ts',
    'docs/engineering/task-records/IMP-001-P2-request-platform-auth-plumbing.md',
  ];

  it('ships all P2 foundation files', () => {
    for (const file of expectedFiles) {
      expect(existsSync(path.join(root, file)), file).toBe(true);
    }
  });

  it('error envelope uses requestId (ACF-001), not correlationId body field', () => {
    const envelope = read('apps/api/src/common/errors/error-envelope.ts');
    expect(envelope).toContain('requestId');
    expect(envelope).not.toMatch(/correlationId:\s*string/);
  });

  it('wires dual correlation headers and middleware order on AppModule', () => {
    const constants = read('apps/api/src/common/correlation/correlation.constants.ts');
    expect(constants).toContain('x-request-id');
    expect(constants).toContain('x-correlation-id');

    const appModule = read('apps/api/src/app.module.ts');
    expect(appModule).toContain('CorrelationIdMiddleware');
    expect(appModule).toContain('AuthContextMiddleware');
    expect(appModule).toContain('TenantContextMiddleware');
    expect(appModule).toContain('RequestPlatformModule');
  });

  it('exports AuditPublisher from platform-operations public barrel only', () => {
    const barrel = read('apps/api/src/modules/platform-operations/index.ts');
    expect(barrel).toContain('AUDIT_PUBLISHER');
    expect(barrel).toContain('AuditPublisher');
  });

  it('does not open identity/tenant business HTTP routes', () => {
    const identityCtrl = read(
      'apps/api/src/modules/identity-and-access/controllers/identity-and-access.controller.ts',
    );
    const tenantCtrl = read(
      'apps/api/src/modules/tenant-and-billing/controllers/tenant-and-billing.controller.ts',
    );
    expect(identityCtrl).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
    expect(tenantCtrl).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
  });

  it('uses membership factory (DB or DenyAll); token validator lives in Identity module', () => {
    const platform = read('apps/api/src/common/request-platform/request-platform.module.ts');
    expect(platform).toContain('DenyAllTenantMembershipChecker');
    expect(platform).toContain('PgTenantMembershipChecker');
    expect(platform).toContain('MembershipAwarePermissionSource');
    expect(platform).toContain('PgPermissionSource');
    expect(platform).toContain('EmptyPermissionSource');
    const identity = read('apps/api/src/modules/identity-and-access/identity-and-access.module.ts');
    expect(identity).toContain('RejectAllTokenValidator');
    expect(identity).toContain('SessionTokenValidator');
    expect(identity).toContain('TOKEN_VALIDATOR');
  });

  it('ships Nest persistence + Pg membership checker without business routes', () => {
    expect(existsSync(path.join(root, 'apps/api/src/common/persistence/database.module.ts'))).toBe(
      true,
    );
    expect(
      existsSync(path.join(root, 'apps/api/src/common/tenant/pg-tenant-membership.checker.ts')),
    ).toBe(true);
  });
});
