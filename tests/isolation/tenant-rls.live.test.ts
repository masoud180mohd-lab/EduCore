import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

/**
 * Live RLS isolation suite (AUDIT-R2 / G3).
 *
 * Runs when Postgres is reachable at DEV-001 defaults.
 * Set RUN_LIVE_DB_TESTS=1 to fail if the database is unavailable.
 * Without that flag, unavailable DB → suite skipped (local DX).
 *
 * Adapted DBF-001 T1–T8 for tables that exist today (tenants/users).
 */

const forceLive = process.env['RUN_LIVE_DB_TESTS'] === '1';

function adminUrl(): string {
  if (process.env['DATABASE_URL'] !== undefined && process.env['DATABASE_URL'].trim() !== '') {
    return process.env['DATABASE_URL'].trim();
  }
  // Prefer a privileged local login for migrate/bootstrap (native install often uses postgres).
  const user = process.env['POSTGRES_USER'] ?? process.env['POSTGRES_SUPERUSER'] ?? 'postgres';
  const password =
    process.env['POSTGRES_PASSWORD'] ??
    process.env['POSTGRES_SUPERUSER_PASSWORD'] ??
    'educore_local_only';
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function roleUrl(role: 'educore_app' | 'educore_platform', password: string): string {
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';
  return `postgresql://${encodeURIComponent(role)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function canConnect(url: string): Promise<boolean> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
    return false;
  }
}

async function setPlatformGucs(client: pg.Client): Promise<void> {
  await client.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
  await client.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);
}

async function setTenantContext(client: pg.Client, tenantId: string): Promise<void> {
  await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
  await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('AUDIT-R2 live tenant RLS isolation', () => {
  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable. Start DEV-001: npm run docker:up',
      );
    }

    // Align migrate/bootstrap with the same privileged URL used for connectivity
    // (scripts default POSTGRES_USER=educore, which often lacks CREATEROLE).
    const privilegedEnv = {
      ...process.env,
      DATABASE_URL: adminUrl(),
    };

    const migrate = spawnSync('npm', ['run', 'db:migrate'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: privilegedEnv,
    });
    if (migrate.status !== 0) {
      throw new Error(`db:migrate failed: ${migrate.stderr || migrate.stdout}`);
    }
    const bootstrap = spawnSync('npm', ['run', 'db:bootstrap-roles'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: privilegedEnv,
    });
    if (bootstrap.status !== 0) {
      // Roles may already exist from a prior bootstrap; continue if educore_app works.
      const appRoleOk = await canConnect(roleUrl('educore_app', 'educore_app_local_only'));
      if (!appRoleOk) {
        throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
      }
    }
  });

  it('T7/G3: educore_app cannot INSERT tenants even after spoofing both GUCs', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    await app.connect();
    try {
      await app.query('BEGIN');
      await setPlatformGucs(app);
      await expect(
        app.query(
          `INSERT INTO tenants (id, code, name, status)
           VALUES ($1, $2, $3, 'draft')`,
          [randomUUID(), `spoof-${String(Date.now())}`, 'Spoof Tenant'],
        ),
      ).rejects.toThrow();
      await app.query('ROLLBACK');
    } finally {
      await app.end();
    }
  });

  it('G3: educore_platform INSERT fails with only rls_mode spoofed', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    await platform.connect();
    try {
      await platform.query('BEGIN');
      await platform.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);
      await platform.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
      await expect(
        platform.query(
          `INSERT INTO tenants (id, code, name, status)
           VALUES ($1, $2, $3, 'draft')`,
          [randomUUID(), `mode-only-${String(Date.now())}`, 'Mode Only'],
        ),
      ).rejects.toThrow();
      await platform.query('ROLLBACK');
    } finally {
      await platform.end();
    }
  });

  it('G3: educore_platform INSERT succeeds with trusted platform session', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    await platform.connect();
    const tenantId = randomUUID();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status)
         VALUES ($1, $2, $3, 'active')`,
        [tenantId, `ok-${String(Date.now())}`, 'Trusted Platform Tenant'],
      );
      const result = await platform.query<{ id: string }>('SELECT id FROM tenants WHERE id = $1', [
        tenantId,
      ]);
      expect(result.rowCount).toBe(1);
      await platform.query('ROLLBACK');
    } finally {
      await platform.end();
    }
  });

  it('T1/T2 adapted: educore_app with tenant A context cannot see tenant B', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const stamp = String(Date.now());

    await platform.connect();
    await app.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Tenant A', 'active'),
         ($3, $4, 'Tenant B', 'active')`,
        [tenantA, `a-${stamp}`, tenantB, `b-${stamp}`],
      );
      await platform.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ id: string }>('SELECT id FROM tenants ORDER BY code');
      const ids = visible.rows.map((row) => row.id);
      expect(ids).toContain(tenantA);
      expect(ids).not.toContain(tenantB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });

  it('T3 adapted: spoofed platform GUCs on educore_app do not reveal all tenants', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    await app.connect();
    try {
      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.current_tenant', '', true)`);
      await app.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
      await app.query(`SELECT set_config('app.rls_mode', 'platform', true)`);
      const result = await app.query('SELECT id FROM tenants');
      expect(result.rowCount).toBe(0);
      await app.query('ROLLBACK');
    } finally {
      await app.end();
    }
  });

  it('membership: active member sees own tenant; non-member does not; can see same-tenant users', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();
    const stamp = String(Date.now());

    await platform.connect();
    await app.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Mem A', 'active'),
         ($3, $4, 'Mem B', 'active')`,
        [tenantA, `ma-${stamp}`, tenantB, `mb-${stamp}`],
      );
      await platform.query(
        `INSERT INTO users (id, email, display_name, status) VALUES
         ($1, $2, 'User A', 'active'),
         ($3, $4, 'User B', 'active')`,
        [userA, `a-${stamp}@example.com`, userB, `b-${stamp}@example.com`],
      );
      await platform.query(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status, joined_at) VALUES
         ($1, $2, $3, 'active', now())`,
        [randomUUID(), tenantA, userA],
      );
      await platform.query('COMMIT');

      // Member of A with current_user A: can see tenant A, not B; can see user A; not user B without membership.
      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      await app.query(`SELECT set_config('app.current_user', $1, true)`, [userA]);

      const tenants = await app.query<{ id: string }>('SELECT id FROM tenants');
      const tenantIds = tenants.rows.map((r) => r.id);
      expect(tenantIds).toContain(tenantA);
      expect(tenantIds).not.toContain(tenantB);

      const usersVisible = await app.query<{ id: string }>('SELECT id FROM users ORDER BY email');
      const userIds = usersVisible.rows.map((r) => r.id);
      expect(userIds).toContain(userA);
      expect(userIds).not.toContain(userB);

      const memberships = await app.query(
        'SELECT tenant_id FROM tenant_memberships WHERE user_id = $1',
        [userA],
      );
      expect(memberships.rowCount).toBe(1);

      await app.query('ROLLBACK');

      // Same user, wrong tenant context B without membership: cannot see tenant B via GUC alone if not member
      // (current_tenant = B still allows Pattern B current_tenant match — so set tenant B GUC shows B.
      // Membership-based visibility: user_has_active_membership(B) is false; can_see_tenant(B) true only via GUC.
      // Documented: GUC current_tenant still reveals that tenant row; app layer must not set GUC without membership.
      await app.query('BEGIN');
      await setTenantContext(app, tenantB);
      await app.query(`SELECT set_config('app.current_user', $1, true)`, [userA]);
      const hasMemB = await app.query<{ ok: boolean }>(
        `SELECT app.user_has_active_membership($1::uuid) AS ok`,
        [tenantB],
      );
      expect(hasMemB.rows[0]?.ok).toBe(false);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM tenant_memberships WHERE tenant_id = ANY($1::uuid[])', [
        [tenantA, tenantB],
      ]);
      await admin.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userA, userB]]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });
});

describe.skipIf(dbAvailable || forceLive)('AUDIT-R2 live tenant RLS isolation (skipped)', () => {
  it('skips live isolation when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
