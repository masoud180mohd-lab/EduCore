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
 * ASSURE-001-L — live RLS + HTTP isolation for students + academic structure.
 *
 * Skip unless Postgres reachable. Fail when RUN_LIVE_DB_TESTS=1 and DB down.
 *
 * Env (same as P10):
 *   DATABASE_URL / POSTGRES_* — admin connection
 *   RUN_LIVE_DB_TESTS=1 — fail closed if unreachable
 *   SEED_ADMIN_PASS — local seed password
 *   EDUCORE_ENABLE_APP_DB=1 — Nest uses educore_app pool
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

async function setTenantContext(client: pg.Client, tenantId: string): Promise<void> {
  await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
  await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('ASSURE-001 live students/academic SQL RLS', () => {
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
  }, 180_000);

  it('RLS: educore_app in tenant A cannot read students in tenant B', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const studentA = randomUUID();
    const studentB = randomUUID();
    const stamp = String(Date.now());

    await platform.connect();
    await app.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Stu A', 'active'), ($3, $4, 'Stu B', 'active')`,
        [tenantA, `sta-${stamp}`, tenantB, `stb-${stamp}`],
      );
      await platform.query(
        `INSERT INTO students (id, tenant_id, display_name, status) VALUES
         ($1, $2, 'Student A', 'active'), ($3, $4, 'Student B', 'active')`,
        [studentA, tenantA, studentB, tenantB],
      );
      await platform.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ id: string }>(`SELECT id FROM students`);
      const ids = visible.rows.map((r) => r.id);
      expect(ids).toContain(studentA);
      expect(ids).not.toContain(studentB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM students WHERE id = ANY($1::uuid[])', [[studentA, studentB]]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });

  it('RLS: educore_app in tenant A cannot read classes in tenant B', async () => {
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const yearA = randomUUID();
    const yearB = randomUUID();
    const classA = randomUUID();
    const classB = randomUUID();
    const stamp = String(Date.now());

    await platform.connect();
    await app.connect();
    await admin.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Cls A', 'active'), ($3, $4, 'Cls B', 'active')`,
        [tenantA, `cla-${stamp}`, tenantB, `clb-${stamp}`],
      );
      await platform.query(
        `INSERT INTO academic_years (id, tenant_id, name, status) VALUES
         ($1, $2, 'Year A', 'active'), ($3, $4, 'Year B', 'active')`,
        [yearA, tenantA, yearB, tenantB],
      );
      await platform.query(
        `INSERT INTO classes (id, tenant_id, academic_year_id, name, status) VALUES
         ($1, $2, $3, 'Class A', 'active'), ($4, $5, $6, 'Class B', 'active')`,
        [classA, tenantA, yearA, classB, tenantB, yearB],
      );
      await platform.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ id: string }>(`SELECT id FROM classes`);
      const ids = visible.rows.map((r) => r.id);
      expect(ids).toContain(classA);
      expect(ids).not.toContain(classB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM classes WHERE id = ANY($1::uuid[])', [[classA, classB]]);
      await admin.query('DELETE FROM academic_years WHERE id = ANY($1::uuid[])', [[yearA, yearB]]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await platform.end();
      await admin.end();
    }
  });
});

describe.skipIf(!dbAvailable && !forceLive)('ASSURE-001 live students/academic HTTP', () => {
  let nestApp: INestApplication;
  let server: Server;
  let accessToken: string;
  let foreignStudentId: string;
  let foreignClassId: string;
  let foreignYearId: string;
  let tenantB: string;

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

    nestApp = moduleRef.createNestApplication();
    await nestApp.init();
    await nestApp.listen(0);
    server = nestApp.getHttpServer() as Server;

    process.env['SEED_ADMIN_PASS'] = seedPassword;
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

    foreignStudentId = randomUUID();
    foreignClassId = randomUUID();
    foreignYearId = randomUUID();
    tenantB = randomUUID();
    const stamp = String(Date.now());
    const platform = new Client({
      connectionString: roleUrl('educore_platform', 'educore_platform_local_only'),
    });
    await platform.connect();
    try {
      await platform.query('BEGIN');
      await setPlatformGucs(platform);
      await platform.query(
        `INSERT INTO tenants (id, code, name, status) VALUES ($1, $2, 'HTTP Stu B', 'active')`,
        [tenantB, `httpstu-${stamp}`],
      );
      await platform.query(
        `INSERT INTO students (id, tenant_id, display_name, status) VALUES
         ($1, $2, 'Foreign Student', 'active')`,
        [foreignStudentId, tenantB],
      );
      await platform.query(
        `INSERT INTO academic_years (id, tenant_id, name, status) VALUES
         ($1, $2, 'Foreign Year', 'active')`,
        [foreignYearId, tenantB],
      );
      await platform.query(
        `INSERT INTO classes (id, tenant_id, academic_year_id, name, status) VALUES
         ($1, $2, $3, 'Foreign Class', 'active')`,
        [foreignClassId, tenantB, foreignYearId],
      );
      await platform.query('COMMIT');
    } finally {
      await platform.end();
    }
  }, 180_000);

  afterAll(async () => {
    await nestApp.close();
    const admin = new Client({ connectionString: adminUrl() });
    await admin.connect();
    try {
      await admin.query('DELETE FROM classes WHERE id = $1::uuid', [foreignClassId]);
      await admin.query('DELETE FROM academic_years WHERE id = $1::uuid', [foreignYearId]);
      await admin.query('DELETE FROM students WHERE id = $1::uuid', [foreignStudentId]);
      await admin.query('DELETE FROM tenants WHERE id = $1::uuid', [tenantB]);
    } finally {
      await admin.end();
    }
  });

  it('GET /students returns 401 without bearer', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /students returns 400 without X-Tenant-Id', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      authorization: `Bearer ${accessToken}`,
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /students returns 200 for bound seeded tenant', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: unknown[]; page: { limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.page.limit).toBe(25);
  });

  it('GET /students/:id returns 404 for cross-tenant student id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/students/${foreignStudentId}`, {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(404);
    expect(parseErrorBody(response.body).error?.code).toBe('NOT_FOUND');
  });

  it('GET /students returns 403 on session/header tenant mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/students', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': tenantB,
    });
    expect(response.statusCode).toBe(403);
    expect(parseErrorBody(response.body).error?.details?.['reason']).toBe(
      'SESSION_TENANT_MISMATCH',
    );
  });

  it('GET /academic-years returns 200 for bound tenant', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/academic-years', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /classes/:id returns 404 for cross-tenant class id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/classes/${foreignClassId}`, {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(404);
  });

  it('GET /classes returns 403 on session mismatch', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/classes', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': '01900000-0000-7000-8000-000000009999',
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /subjects returns 200 for bound tenant', async () => {
    const response = await httpCall(server, 'GET', '/api/v1/subjects', {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /academic-years/:id returns 404 for foreign year id', async () => {
    const response = await httpCall(server, 'GET', `/api/v1/academic-years/${foreignYearId}`, {
      'authorization': `Bearer ${accessToken}`,
      'x-tenant-id': SEED_TENANT_ID,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe.skipIf(dbAvailable || forceLive)('ASSURE-001 live students/academic (skipped)', () => {
  it('skips when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
