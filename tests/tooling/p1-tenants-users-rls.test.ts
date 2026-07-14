import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), 'utf8');
}

function allUpSql(): string {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.up.sql'))
    .map((f) => readMigration(f))
    .join('\n');
}

describe('IMP-001 P1 tenants + users + first RLS policies', () => {
  it('creates tenants and users tables per DBF-001', () => {
    const ddl = readMigration('20260714150000_tenants_and_users.up.sql');
    expect(ddl).toMatch(/CREATE TABLE tenants/i);
    expect(ddl).toMatch(/CREATE TABLE users/i);
    expect(ddl).toMatch(/code text NOT NULL/i);
    expect(ddl).toMatch(/email citext NOT NULL/i);
    expect(ddl).toMatch(/password_hash text NULL/i);
    expect(ddl).toMatch(/ck_tenants_status/i);
    expect(ddl).toMatch(/ck_users_status/i);
  });

  it('does not create memberships, sessions, or other deferred tables in this increment', () => {
    const sql = allUpSql().toUpperCase();
    expect(sql).not.toContain('CREATE TABLE TENANT_MEMBERSHIPS');
    expect(sql).not.toContain('CREATE TABLE SESSIONS');
    expect(sql).not.toContain('CREATE TABLE ORGANIZATIONS');
    expect(sql).not.toContain('CREATE TABLE ROLES');
  });

  it('enables FORCE RLS and defines Pattern B/C policies for educore_app', () => {
    const rls = readMigration('20260714160000_tenants_users_rls.up.sql');
    expect(rls).toMatch(/app\.enable_tenant_rls\('tenants'/i);
    expect(rls).toMatch(/app\.enable_tenant_rls\('users'/i);
    expect(rls).toMatch(/CREATE POLICY rls_tenants_select/i);
    expect(rls).toMatch(/CREATE POLICY rls_users_select/i);
    expect(rls).toMatch(/app\.can_see_tenant/i);
    expect(rls).toMatch(/app\.can_see_user/i);
    expect(rls).toMatch(/app\.user_has_active_membership/i);
    expect(rls).toMatch(/rls_mode\(\) IN \('bootstrap', 'platform'\)/i);
    // No DELETE policies for runtime role (deny by default).
    expect(rls.toUpperCase()).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+TENANTS\s+FOR\s+DELETE/);
    expect(rls.toUpperCase()).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+USERS\s+FOR\s+DELETE/);
  });

  it('revokes DELETE from educore_app on tenants and users', () => {
    const ddl = readMigration('20260714150000_tenants_and_users.up.sql');
    expect(ddl).toMatch(/REVOKE DELETE ON TABLE tenants FROM educore_app/i);
    expect(ddl).toMatch(/REVOKE DELETE ON TABLE users FROM educore_app/i);
  });

  it('keeps membership hook as fail-closed placeholder until memberships table exists', () => {
    const rls = readMigration('20260714160000_tenants_users_rls.up.sql');
    expect(rls).toMatch(/CREATE OR REPLACE FUNCTION app\.user_has_active_membership/i);
    expect(rls).toMatch(/SELECT false/i);
  });
});
