import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-001 P4 RBAC foundation (ADR-012)', () => {
  it('keeps roles RBAC migration with RLS and membership-gated codes', () => {
    const ddl = read('apps/api/db/migrations/20260715010000_roles_rbac.up.sql');
    expect(ddl).toMatch(/CREATE TABLE roles/i);
    expect(ddl).toMatch(/CREATE TABLE role_permissions/i);
    expect(ddl).toMatch(/CREATE TABLE user_roles/i);
    expect(ddl).toMatch(/app\.user_permission_codes/i);
    expect(ddl).toMatch(/user_has_active_membership/i);
    expect(ddl).toMatch(/FORCE ROW LEVEL SECURITY/i);
  });

  it('ships system role bootstrap + seed wiring', () => {
    const bootstrap = read(
      'apps/api/src/modules/identity-and-access/rbac/system-role-bootstrap.ts',
    );
    const seed = read('scripts/seed-local-admin.ts');
    expect(bootstrap).toContain('bootstrapSystemRolesForTenant');
    expect(seed).toContain('bootstrapSystemRolesForTenant');
    expect(seed).toContain("assignRoleCode: 'owner'");
  });

  it('exposes RequirePermission factory and PolicyEvaluator wiring', () => {
    const guard = read('apps/api/src/common/policy/require-permission.guard.ts');
    const platform = read('apps/api/src/common/request-platform/request-platform.module.ts');
    expect(guard).toContain('export function RequirePermission');
    expect(guard).toContain('assertSessionTenantMatchesHeader');
    expect(platform).toContain('PgPermissionSource');
    expect(platform).toContain('MembershipAwarePermissionSource');
    expect(platform).toContain('PolicyEvaluator');
  });

  it('binds privileged guards to session tenant and ships grant reconciler', () => {
    const membership = read('apps/api/src/common/auth/auth.guards.ts');
    const bind = read('apps/api/src/common/auth/session-tenant-bind.ts');
    const reconcile = read(
      'apps/api/src/modules/identity-and-access/rbac/system-role-grant-reconcile.ts',
    );
    const pkg = read('package.json');
    expect(membership).toContain('assertSessionTenantMatchesHeader');
    expect(bind).toContain('SESSION_TENANT_MISMATCH');
    expect(reconcile).toContain('reconcileSystemRoleGrantsForTenant');
    expect(reconcile).toContain('DELETE FROM role_permissions');
    expect(pkg).toContain('rbac:reconcile-grants');
  });

  it('enriches /auth/me with roles and permissions (no role-admin routes)', () => {
    const authService = read('apps/api/src/modules/identity-and-access/auth/auth.service.ts');
    const authController = read(
      'apps/api/src/modules/identity-and-access/controllers/auth.controller.ts',
    );
    const identityController = read(
      'apps/api/src/modules/identity-and-access/controllers/identity-and-access.controller.ts',
    );
    expect(authService).toContain('permissions');
    expect(authService).toContain('listRolesForUser');
    expect(authController).toMatch(/@Get\('me'\)/);
    expect(authController).not.toMatch(/roles/);
    expect(identityController).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
  });

  it('documents P4 + P4b task records', () => {
    const files = readdirSync(path.join(projectRoot, 'docs/engineering/task-records'));
    expect(files).toContain('IMP-001-P4-rbac-foundation.md');
    expect(files).toContain('IMP-001-P4b-rbac-session-bind-grant-reconcile.md');
  });
});
