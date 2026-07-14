import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { PgPermissionSource } from '../../apps/api/src/common/policy/pg-permission.source.js';

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
      // ignore
    }
    return false;
  }
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('PgPermissionSource live DB', () => {
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
  });

  it('returns role permission codes only for active members with assignments', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    await platform.connect();

    const tenantId = randomUUID();
    const userId = randomUUID();
    const roleId = randomUUID();
    const stamp = String(Date.now());

    try {
      await platform.query('BEGIN');
      await platform.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
      await platform.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES ($1, $2, $3, 'active')`,
        [tenantId, `rbac-${stamp}`, 'RBAC Tenant'],
      );
      await platform.query(
        `INSERT INTO users (id, email, display_name, status) VALUES ($1, $2, $3, 'active')`,
        [userId, `rbac-${stamp}@example.test`, 'RBAC User'],
      );
      await platform.query(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [randomUUID(), tenantId, userId],
      );
      await platform.query(
        `INSERT INTO roles (id, tenant_id, code, name, is_system)
         VALUES ($1, $2, 'staff', 'Staff', true)`,
        [roleId, tenantId],
      );

      const perm = await platform.query<{ id: string }>(
        `SELECT id FROM permissions WHERE code = 'tenant.read' LIMIT 1`,
      );
      expect(perm.rows[0]?.id).toBeTruthy();
      await platform.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
        [roleId, perm.rows[0]!.id],
      );
      await platform.query(
        `INSERT INTO user_roles (id, tenant_id, user_id, role_id)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), tenantId, userId, roleId],
      );
      await platform.query('COMMIT');
    } catch (error) {
      await platform.query('ROLLBACK');
      await platform.end();
      throw error;
    }
    await platform.end();

    const pool = new Pool({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
      max: 2,
    });
    try {
      const source = new PgPermissionSource(pool);
      await expect(source.getPermissions(userId, tenantId)).resolves.toEqual(
        new Set(['tenant.read']),
      );
      await expect(source.getPermissions(userId, randomUUID())).resolves.toEqual(new Set());
    } finally {
      await pool.end();
    }
  });
});
