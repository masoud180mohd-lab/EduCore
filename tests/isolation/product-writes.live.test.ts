import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

/**
 * F-008 — live write isolation for attendance, marks, invoices, and webhook ingest.
 *
 * Reads-only suites are not enough: educore_app must not INSERT tenant tables,
 * and SECURITY DEFINER helpers must not write tenant B for a member of A.
 */

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

function roleUrl(role: 'educore_app', password: string): string {
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

function pgCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

async function expectDenied(
  client: pg.Client,
  fn: () => Promise<unknown>,
  code = '42501',
): Promise<void> {
  await client.query('SAVEPOINT f008_deny');
  try {
    await expect(fn()).rejects.toSatisfy((error: unknown) => pgCode(error) === code);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT f008_deny');
  }
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('F-008 live product write isolation', () => {
  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable. Start DEV-001: npm run docker:up',
      );
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
      const appOk = await canConnect(roleUrl('educore_app', 'educore_app_local_only'));
      if (!appOk) {
        throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
      }
    }
  }, 120_000);

  it('educore_app cannot INSERT attendance, marks, invoices, or gateway events', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    await app.connect();
    try {
      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.current_tenant', $1, true)`, [randomUUID()]);
      await app.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);

      await expectDenied(app, () =>
        app.query(
          `INSERT INTO attendance_sessions
             (id, tenant_id, class_id, academic_year_id, session_date, status)
           VALUES ($1, $2, $3, $4, '2026-01-01', 'open')`,
          [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
        ),
      );
      await expectDenied(app, () =>
        app.query(
          `INSERT INTO marks (id, tenant_id, exam_subject_id, student_id)
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
        ),
      );
      await expectDenied(app, () =>
        app.query(
          `INSERT INTO invoices (id, tenant_id, student_id, academic_year_id, status)
           VALUES ($1, $2, $3, $4, 'draft')`,
          [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
        ),
      );
      await expectDenied(app, () =>
        app.query(
          `INSERT INTO payment_gateway_events
             (id, tenant_id, provider_code, provider_event_id, payload_sha256)
           VALUES ($1, $2, 'clickpesa', 'evt-f008', 'sha')`,
          [randomUUID(), randomUUID()],
        ),
      );
      await app.query('ROLLBACK');
    } finally {
      await app.end();
    }
  });

  it('member of tenant A cannot write tenant B via SECURITY DEFINER helpers', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const userA = randomUUID();
    const yearA = randomUUID();
    const yearB = randomUUID();
    const classB = randomUUID();
    const studentB = randomUUID();
    const invoiceB = randomUUID();
    const stamp = String(Date.now());

    await app.connect();
    await admin.connect();
    try {
      await admin.query('BEGIN');
      await admin.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Write A', 'active'), ($3, $4, 'Write B', 'active')`,
        [tenantA, `wa-${stamp}`, tenantB, `wb-${stamp}`],
      );
      await admin.query(
        `INSERT INTO users (id, email, display_name, status)
         VALUES ($1, $2, 'Writer A', 'active')`,
        [userA, `wa-${stamp}@example.com`],
      );
      await admin.query(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status, joined_at)
         VALUES ($1, $2, $3, 'active', now())`,
        [randomUUID(), tenantA, userA],
      );
      await admin.query(
        `INSERT INTO academic_years (id, tenant_id, name, status) VALUES
         ($1, $2, 'Year A', 'active'), ($3, $4, 'Year B', 'active')`,
        [yearA, tenantA, yearB, tenantB],
      );
      await admin.query(
        `INSERT INTO classes (id, tenant_id, academic_year_id, name, status)
         VALUES ($1, $2, $3, 'Class B', 'active')`,
        [classB, tenantB, yearB],
      );
      await admin.query(
        `INSERT INTO students (id, tenant_id, display_name, status)
         VALUES ($1, $2, 'Student B', 'active')`,
        [studentB, tenantB],
      );
      await admin.query(
        `INSERT INTO invoices (id, tenant_id, student_id, academic_year_id, status)
         VALUES ($1, $2, $3, $4, 'draft')`,
        [invoiceB, tenantB, studentB, yearB],
      );
      await admin.query('COMMIT');

      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantA]);
      await app.query(`SELECT set_config('app.current_user', $1, true)`, [userA]);
      await app.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
      await app.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);

      await expectDenied(app, () =>
        app.query(
          `SELECT * FROM app.create_attendance_session(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, NULL::uuid, '2026-01-15'::date, NULL::text
           )`,
          [userA, tenantB, randomUUID(), classB],
        ),
      );

      await expectDenied(
        app,
        () =>
          app.query(
            `SELECT * FROM app.create_attendance_session(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, NULL::uuid, '2026-01-16'::date, NULL::text
             )`,
            [userA, tenantA, randomUUID(), classB],
          ),
        '22023',
      );

      await expectDenied(app, () =>
        app.query(`SELECT app.upsert_marks($1::uuid, $2::uuid, $3::uuid, '[]'::jsonb)`, [
          userA,
          tenantB,
          randomUUID(),
        ]),
      );

      await expectDenied(app, () =>
        app.query(
          `SELECT * FROM app.create_invoice_draft(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NULL::uuid, $6::jsonb
           )`,
          [
            userA,
            tenantB,
            randomUUID(),
            studentB,
            yearB,
            JSON.stringify([{ id: randomUUID(), description: 'Fee', amountMinor: 1000 }]),
          ],
        ),
      );

      await expectDenied(
        app,
        () =>
          app.query(`SELECT * FROM app.issue_invoice($1::uuid, $2::uuid, $3::uuid)`, [
            userA,
            tenantA,
            invoiceB,
          ]),
        'P0002',
      );

      await expectDenied(app, () =>
        app.query(
          `SELECT * FROM app.create_pending_mobile_money_attempt(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, 1000::bigint, 'TZS', 'clickpesa', 'ref-b'
           )`,
          [userA, tenantB, randomUUID(), invoiceB],
        ),
      );

      await expectDenied(app, () =>
        app.query(
          `SELECT * FROM app.ingest_clickpesa_gateway_event(
             $1::uuid, $2::text, $3::text, $4::uuid, $5::bigint, $6::text, $7::uuid
           )`,
          [randomUUID(), 'evt-f008', 'c'.repeat(64), randomUUID(), 1000, 'succeeded', randomUUID()],
        ),
      );

      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM invoices WHERE id = $1', [invoiceB]);
      await admin.query('DELETE FROM students WHERE id = $1', [studentB]);
      await admin.query('DELETE FROM classes WHERE id = $1', [classB]);
      await admin.query('DELETE FROM academic_years WHERE id = ANY($1::uuid[])', [[yearA, yearB]]);
      await admin.query('DELETE FROM tenant_memberships WHERE user_id = $1', [userA]);
      await admin.query('DELETE FROM users WHERE id = $1', [userA]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await admin.end();
    }
  });
});

describe.skipIf(dbAvailable || forceLive)('F-008 live product write isolation (skipped)', () => {
  it('skips live isolation when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
