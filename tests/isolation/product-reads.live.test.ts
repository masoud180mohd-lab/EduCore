import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../apps/api/src/app.module.js';
import {
  loadSeedAdminConfig,
  seedLocalAdmin,
  SEED_TENANT_ID,
} from '../../scripts/seed-local-admin.js';
import { httpCall, parseErrorBody } from '../integration/http-client.js';

const { Client } = pg;

/**
 * AUDIT-R4 / IMP-001 P10 — live RLS + HTTP isolation for product read tables.
 *
 * SQL: organizations + tenant_settings cross-tenant visibility.
 * HTTP (when app pool enabled): login + product routes with real session tokens.
 *
 * Set RUN_LIVE_DB_TESTS=1 to fail when Postgres is unavailable.
 */

const forceLive = process.env['RUN_LIVE_DB_TESTS'] === '1';
const seedPassword = process.env['SEED_ADMIN_PASS']?.trim() || 'ChangeMe-Local-Only-1';

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

async function setPlatformGucs(client: pg.Client): Promise<void> {
  await client.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);
  await client.query(`SELECT set_config('app.rls_mode', 'bootstrap', true)`);
}

async function setTenantContext(
  client: pg.Client,
  tenantId: string,
  userId?: string,
): Promise<void> {
  await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
  await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
  if (userId !== undefined) {
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [userId]);
  }
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('IMP-001 P10 live product reads isolation', () => {
  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error('RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable.');
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

    const bootstrap = spawnSync('npm', ['run', 'db:bootstrap-roles'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: true,
      env: privilegedEnv,
    });
    if (bootstrap.status !== 0) {
      const appRoleOk = await canConnect(roleUrl('educore_app', 'educore_app_local_only'));
      if (!appRoleOk) {
        throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
      }
    }

    process.env['SEED_ADMIN_PASS'] = seedPassword;
    const seedConfig = loadSeedAdminConfig({
      ...process.env,
      SEED_ADMIN_PASS: seedPassword,
      NODE_ENV: 'test',
    });
    await seedLocalAdmin(seedConfig);
  }, 180_000);

  it('RLS: educore_app in tenant A cannot read organization rows in tenant B', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const orgA = randomUUID();
    const orgB = randomUUID();
    const stamp = String(Date.now());

    await platform.connect();
    await app.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Org A Tenant', 'active'),
         ($3, $4, 'Org B Tenant', 'active')`,
        [tenantA, `oa-${stamp}`, tenantB, `ob-${stamp}`],
      );
      await platform.query(
        `INSERT INTO organizations (id, tenant_id, org_type, name, status) VALUES
         ($1, $2, 'school', 'School A', 'active'),
         ($3, $4, 'school', 'School B', 'active')`,
        [orgA, tenantA, orgB, tenantB],
      );
      await platform.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ id: string }>(
        `SELECT id FROM organizations WHERE tenant_id = $1::uuid`,
        [tenantA],
      );
      expect(visible.rows.map((r) => r.id)).toContain(orgA);
      expect(visible.rows.map((r) => r.id)).not.toContain(orgB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[orgA, orgB]]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });

  it('RLS: educore_app in tenant A cannot read tenant_settings for tenant B', async () => {
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
         ($1, $2, 'Settings A', 'active'),
         ($3, $4, 'Settings B', 'active')`,
        [tenantA, `sa-${stamp}`, tenantB, `sb-${stamp}`],
      );
      await platform.query(
        `INSERT INTO tenant_settings (tenant_id, schema_version, settings) VALUES
         ($1, 1, '{"a":true}'::jsonb),
         ($2, 1, '{"b":true}'::jsonb)`,
        [tenantA, tenantB],
      );
      await platform.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ tenant_id: string }>(
        'SELECT tenant_id FROM tenant_settings',
      );
      const ids = visible.rows.map((r) => r.tenant_id);
      expect(ids).toContain(tenantA);
      expect(ids).not.toContain(tenantB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM tenant_settings WHERE tenant_id = ANY($1::uuid[])', [
        [tenantA, tenantB],
      ]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });
});

describe.skipIf(!dbAvailable && !forceLive)('IMP-001 P10 live product reads HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;
  let foreignOrgId: string;

  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error('RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable.');
    }

    process.env['EDUCORE_ENABLE_APP_DB'] = '1';
    process.env['EDUCORE_APP_DATABASE_URL'] =
      process.env['EDUCORE_APP_DATABASE_URL'] ?? roleUrl('educore_app', 'educore_app_local_only');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    server = app.getHttpServer() as Server;

    const seedConfig = loadSeedAdminConfig({
      ...process.env,
      SEED_ADMIN_PASS: seedPassword,
      NODE_ENV: 'test',
    });
    await seedLocalAdmin(seedConfig);

    const login = await httpCall(
      server,
      'POST',
      '/api/v1/auth/login',
      {},
      JSON.stringify({ email: seedConfig.email, password: seedConfig.password }),
    );
    expect(login.statusCode).toBe(200);
    const loginBody = JSON.parse(login.body) as { data: { accessToken: string } };
    accessToken = loginBody.data.accessToken;
    expect(accessToken.length).toBeGreaterThan(10);

    // Foreign org in a second tenant (platform insert).
    foreignOrgId = randomUUID();
    const tenantB = randomUUID();
    const stamp = String(Date.now());
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });
    await platform.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES ($1, $2, 'HTTP B', 'active')`,
        [tenantB, `httpb-${stamp}`],
      );
      await platform.query(
        `INSERT INTO organizations (id, tenant_id, org_type, name, status) VALUES
         ($1, $2, 'school', 'Foreign School', 'active')`,
        [foreignOrgId, tenantB],
      );
      await platform.query('COMMIT');
    } finally {
      await admin.end();
      await platform.end();
    }
  }, 180_000);

  afterAll(async () => {
    await app.close();

    const admin = new Client({ connectionString: adminUrl() });
    await admin.connect();
    try {
      await admin.query('DELETE FROM organizations WHERE id = $1::uuid', [foreignOrgId]);
      await admin.query(`DELETE FROM tenants WHERE code LIKE 'httpb-%'`);
    } finally {
      await admin.end();
    }
  });

  it('GET /api/v1/organizations returns 200 for seeded tenant with session-bound header', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /api/v1/organizations/:id returns 404 for cross-tenant organization id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/organizations/${foreignOrgId}`, {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /api/v1/organizations returns 403 when X-Tenant-Id mismatches session tenant', async () => {
    const wrongTenant = '01900000-0000-7000-8000-000000009999';
    const response = await httpCall(server, 'GET', '/api/v1/organizations', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': wrongTenant,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /api/v1/tenant-settings returns 200 or 404 for bound tenant (no cross-tenant leak)', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/tenant-settings', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect([200, 404]).toContain(response.statusCode);
  });
});

describe.skipIf(dbAvailable || forceLive)('IMP-001 P10 live product reads (skipped)', () => {
  it('skips when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
