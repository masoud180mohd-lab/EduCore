import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), 'utf8');
}

describe('IMP-001 P2 roles RBAC scaffolding', () => {
  it('creates roles, role_permissions, user_roles with educore_app read-only', () => {
    const ddl = readMigration('20260715010000_roles_rbac.up.sql');
    expect(ddl).toMatch(/CREATE TABLE roles/i);
    expect(ddl).toMatch(/CREATE TABLE role_permissions/i);
    expect(ddl).toMatch(/CREATE TABLE user_roles/i);
    expect(ddl).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE roles FROM educore_app/i);
    expect(ddl).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE user_roles FROM educore_app/i);
    expect(ddl).toMatch(/NULLS NOT DISTINCT/i);
    expect(ddl).toMatch(/app\.user_permission_codes/i);
    expect(ddl).toMatch(/SECURITY DEFINER/i);
    expect(ddl).toMatch(/user_has_active_membership/i);
  });

  it('pairs up/down migration files', () => {
    const files = readdirSync(migrationsDir);
    expect(files).toContain('20260715010000_roles_rbac.up.sql');
    expect(files).toContain('20260715010000_roles_rbac.down.sql');
  });

  it('wires PgPermissionSource in request platform when pool present', () => {
    const platform = readFileSync(
      path.join(projectRoot, 'apps/api/src/common/request-platform/request-platform.module.ts'),
      'utf8',
    );
    expect(platform).toContain('PgPermissionSource');
    expect(platform).toContain('MembershipAwarePermissionSource');
    expect(platform).toContain('EmptyPermissionSource');
  });

  it('does not open identity/tenant business HTTP routes', () => {
    const identity = readFileSync(
      path.join(
        projectRoot,
        'apps/api/src/modules/identity-and-access/controllers/identity-and-access.controller.ts',
      ),
      'utf8',
    );
    const tenant = readFileSync(
      path.join(
        projectRoot,
        'apps/api/src/modules/tenant-and-billing/controllers/tenant-and-billing.controller.ts',
      ),
      'utf8',
    );
    expect(identity).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
    expect(tenant).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
  });
});
