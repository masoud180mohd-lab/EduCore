import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), 'utf8');
}

const frozenPermissionCodes = [
  'tenant.read',
  'tenant.manage',
  'organization.read',
  'organization.manage',
  'user.invite',
  'user.read',
  'user.manage',
  'role.read',
  'role.manage',
  'session.revoke',
  'audit.read',
  'entitlement.read',
  'entitlement.manage',
] as const;

describe('IMP-001 P1 catalog tables + RLS foundation', () => {
  it('creates global permissions and plans catalogs in the catalog migration', () => {
    const catalog = readMigration('20260714120000_catalog_permissions_and_plans.up.sql');
    expect(catalog).toMatch(/CREATE TABLE permissions/i);
    expect(catalog).toMatch(/CREATE TABLE plans/i);

    // Catalog migration itself must not create root/tenant tables.
    const forbiddenInCatalogMigration = [
      'CREATE TABLE tenants',
      'CREATE TABLE users',
      'CREATE TABLE organizations',
      'CREATE TABLE tenant_memberships',
      'CREATE TABLE sessions',
      'CREATE TABLE roles',
      'CREATE TABLE entitlements',
      'CREATE TABLE subscriptions',
    ];
    for (const stmt of forbiddenInCatalogMigration) {
      expect(catalog.toUpperCase()).not.toContain(stmt.toUpperCase());
    }
  });

  it('seeds all DBF-001 first-slice permission codes and baseline plans', () => {
    const seed = readMigration('20260714130000_seed_catalogs.up.sql');
    for (const code of frozenPermissionCodes) {
      expect(seed).toContain(`'${code}'`);
    }
    expect(seed).toContain("'trial'");
    expect(seed).toContain("'starter'");
    expect(seed).toContain("'standard'");
  });

  it('installs RLS foundation helpers and FORCE RLS helper', () => {
    const rls = readMigration('20260714140000_rls_foundation.up.sql');
    expect(rls).toMatch(/CREATE SCHEMA IF NOT EXISTS app/i);
    expect(rls).toMatch(/app\.current_tenant_id/i);
    expect(rls).toMatch(/app\.current_user_id/i);
    expect(rls).toMatch(/app\.is_platform_operator/i);
    expect(rls).toMatch(/app\.tenant_isolation_passes/i);
    expect(rls).toMatch(/app\.enable_tenant_rls/i);
    expect(rls.toUpperCase()).toContain('FORCE ROW LEVEL SECURITY');
    expect(rls.toUpperCase()).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE PERMISSIONS');
    expect(rls.toUpperCase()).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE PLANS');
  });

  it('keeps educore_app catalog access read-only in SQL', () => {
    const catalog = readMigration('20260714120000_catalog_permissions_and_plans.up.sql');
    const rls = readMigration('20260714140000_rls_foundation.up.sql');
    expect(catalog).toMatch(/GRANT SELECT ON TABLE permissions TO educore_app/i);
    expect(catalog).toMatch(/GRANT SELECT ON TABLE plans TO educore_app/i);
    expect(rls).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE permissions FROM educore_app/i);
  });

  it('records P1 partial gate', () => {
    const gate = readFileSync(
      path.join(projectRoot, 'docs/engineering/gates/IMP-001-P1-catalog-rls-go-no-go.md'),
      'utf8',
    );
    expect(gate).toMatch(/CONDITIONAL GO|GO/i);
    expect(gate).toContain('catalog');
  });
});
