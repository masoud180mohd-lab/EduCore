import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { PgTenantMembershipChecker } from '../../apps/api/src/common/tenant/pg-tenant-membership.checker.js';

/**
 * Live: PgTenantMembershipChecker against real tenant_memberships + educore_app.
 * Skip when DB unavailable unless RUN_LIVE_DB_TESTS=1.
 */

const { Client, Pool } = pg;
const forceLive = process.env['RUN_LIVE_DB_TESTS'] === '1';

function adminUrl(): string {
  if (process.env['DATABASE_URL'] !== undefined && process.env['DATABASE_URL'].trim() !== '') {
    return process.env['DATABASE_URL'].trim();
  }
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

function appUrl(): string {
  if (
    process.env['EDUCORE_APP_DATABASE_URL'] !== undefined &&
    process.env['EDUCORE_APP_DATABASE_URL'].trim() !== ''
  ) {
    return process.env['EDUCORE_APP_DATABASE_URL'].trim();
  }
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';
  return `postgresql://educore_app:educore_app_local_only@${host}:${port}/${database}`;
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
      // ignore
    }
    return false;
  }
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('PgTenantMembershipChecker live DB', () => {
  beforeAll(() => {
    if (!dbAvailable) {
      throw new Error('RUN_LIVE_DB_TESTS=1 but PostgreSQL unreachable');
    }
    const privilegedEnv = { ...process.env, DATABASE_URL: adminUrl() };
    const migrate = spawnSync('npm', ['run', 'db:migrate'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: privilegedEnv,
    });
    if (migrate.status !== 0) {
      throw new Error(`db:migrate failed: ${migrate.stderr || migrate.stdout}`);
    }
    spawnSync('npm', ['run', 'db:bootstrap-roles'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: privilegedEnv,
    });
  }, 120_000);

  it('returns true only for active memberships under educore_app', async () => {
    const platform = new Client({
      connectionString: (() => {
        const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
        const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
        const database = process.env['POSTGRES_DB'] ?? 'educore';
        return `postgresql://educore_platform:educore_platform_local_only@${host}:${port}/${database}`;
      })(),
    });
    await platform.connect();

    const tenantId = randomUUID();
    const userId = randomUUID();
    const otherTenant = randomUUID();
    const stamp = String(Date.now());

    try {
      await platform.query('BEGIN');
      await platform.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
      await platform.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES ($1, $2, $3, 'active'), ($4, $5, $6, 'active')`,
        [tenantId, `chk-a-${stamp}`, 'Checker A', otherTenant, `chk-b-${stamp}`, 'Checker B'],
      );
      await platform.query(
        `INSERT INTO users (id, email, display_name, status) VALUES ($1, $2, $3, 'active')`,
        [userId, `chk-${stamp}@example.test`, 'Checker User'],
      );
      await platform.query(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [randomUUID(), tenantId, userId],
      );
      await platform.query('COMMIT');
    } catch (error) {
      await platform.query('ROLLBACK');
      await platform.end();
      throw error;
    }
    await platform.end();

    const pool = new Pool({ connectionString: appUrl(), max: 2 });
    try {
      const checker = new PgTenantMembershipChecker(pool);
      await expect(checker.hasActiveMembership(userId, tenantId)).resolves.toBe(true);
      await expect(checker.hasActiveMembership(userId, otherTenant)).resolves.toBe(false);
    } finally {
      await pool.end();
    }
  });
});
