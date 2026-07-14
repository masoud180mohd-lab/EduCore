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
  beforeAll(() => {
    if (!dbAvailable) {
      throw new Error(
        'RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable. Start DEV-001: npm run docker:up',
      );
    }

    const migrate = spawnSync('npm', ['run', 'db:migrate'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: process.env,
    });
    if (migrate.status !== 0) {
      throw new Error(`db:migrate failed: ${migrate.stderr || migrate.stdout}`);
    }
    const bootstrap = spawnSync('npm', ['run', 'db:bootstrap-roles'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: process.env,
    });
    if (bootstrap.status !== 0) {
      throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
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
});

describe.skipIf(dbAvailable || forceLive)('AUDIT-R2 live tenant RLS isolation (skipped)', () => {
  it('skips live isolation when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
