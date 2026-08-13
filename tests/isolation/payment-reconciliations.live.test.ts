import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

/**
 * F-016 — live RLS isolation for payment_reconciliations.
 *
 * educore_app SELECT must be tenant-scoped. Cross-tenant rows must not appear.
 * Skip unless Postgres is reachable. Fail when RUN_LIVE_DB_TESTS=1 and DB is down.
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
      // ignore close errors
    }
    return false;
  }
}

async function setTenantContext(client: pg.Client, tenantId: string): Promise<void> {
  await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
  await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
  await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
}

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('F-016 live payment_reconciliations RLS', () => {
  beforeAll(async () => {
    if (!dbAvailable) {
      throw new Error(
        'RUN_LIVE_DB_TESTS=1 but PostgreSQL is unreachable. Start DEV-001: npm run docker:up',
      );
    }

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
      const appRoleOk = await canConnect(roleUrl('educore_app', 'educore_app_local_only'));
      if (!appRoleOk) {
        throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
      }
    }
  }, 120_000);

  it('ENABLE + FORCE RLS is on payment_reconciliations', async () => {
    const admin = new Client({ connectionString: adminUrl() });
    await admin.connect();
    try {
      const flags = await admin.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'payment_reconciliations'`,
      );
      expect(flags.rows[0]?.relrowsecurity).toBe(true);
      expect(flags.rows[0]?.relforcerowsecurity).toBe(true);
    } finally {
      await admin.end();
    }
  });

  it('educore_app in tenant A cannot SELECT tenant B payment_reconciliations', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    const admin = new Client({ connectionString: adminUrl() });

    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const studentA = randomUUID();
    const studentB = randomUUID();
    const yearA = randomUUID();
    const yearB = randomUUID();
    const invoiceA = randomUUID();
    const invoiceB = randomUUID();
    const paymentA = randomUUID();
    const paymentB = randomUUID();
    const reconA = randomUUID();
    const reconB = randomUUID();
    const stamp = String(Date.now());

    await app.connect();
    await admin.connect();
    try {
      await admin.query('BEGIN');
      await admin.query(
        `INSERT INTO tenants (id, code, name, status) VALUES
         ($1, $2, 'Recon A', 'active'), ($3, $4, 'Recon B', 'active')`,
        [tenantA, `pra-${stamp}`, tenantB, `prb-${stamp}`],
      );
      await admin.query(
        `INSERT INTO students (id, tenant_id, display_name, status) VALUES
         ($1, $2, 'Student A', 'active'), ($3, $4, 'Student B', 'active')`,
        [studentA, tenantA, studentB, tenantB],
      );
      await admin.query(
        `INSERT INTO academic_years (id, tenant_id, name, status) VALUES
         ($1, $2, 'Year A', 'active'), ($3, $4, 'Year B', 'active')`,
        [yearA, tenantA, yearB, tenantB],
      );
      await admin.query(
        `INSERT INTO invoices (id, tenant_id, student_id, academic_year_id, status) VALUES
         ($1, $2, $3, $4, 'issued'), ($5, $6, $7, $8, 'issued')`,
        [invoiceA, tenantA, studentA, yearA, invoiceB, tenantB, studentB, yearB],
      );
      await admin.query(
        `INSERT INTO payment_attempts
           (id, tenant_id, invoice_id, method, amount_minor, status) VALUES
         ($1, $2, $3, 'cash', 1000, 'succeeded'),
         ($4, $5, $6, 'cash', 2000, 'succeeded')`,
        [paymentA, tenantA, invoiceA, paymentB, tenantB, invoiceB],
      );
      await admin.query(
        `INSERT INTO payment_reconciliations
           (id, tenant_id, payment_attempt_id, outcome, attempt_amount_minor, attempt_status)
         VALUES
           ($1, $2, $3, 'matched', 1000, 'succeeded'),
           ($4, $5, $6, 'matched', 2000, 'succeeded')`,
        [reconA, tenantA, paymentA, reconB, tenantB, paymentB],
      );
      await admin.query('COMMIT');

      await app.query('BEGIN');
      await setTenantContext(app, tenantA);
      const visible = await app.query<{ id: string }>(`SELECT id FROM payment_reconciliations`);
      const ids = visible.rows.map((r) => r.id);
      expect(ids).toContain(reconA);
      expect(ids).not.toContain(reconB);
      await app.query('ROLLBACK');

      await app.query('BEGIN');
      const unscoped = await app.query<{ id: string }>(`SELECT id FROM payment_reconciliations`);
      expect(unscoped.rows.map((r) => r.id)).not.toContain(reconA);
      expect(unscoped.rows.map((r) => r.id)).not.toContain(reconB);
      await app.query('ROLLBACK');
    } finally {
      await admin.query('DELETE FROM payment_reconciliations WHERE id = ANY($1::uuid[])', [
        [reconA, reconB],
      ]);
      await admin.query('DELETE FROM payment_attempts WHERE id = ANY($1::uuid[])', [
        [paymentA, paymentB],
      ]);
      await admin.query('DELETE FROM invoices WHERE id = ANY($1::uuid[])', [[invoiceA, invoiceB]]);
      await admin.query('DELETE FROM students WHERE id = ANY($1::uuid[])', [[studentA, studentB]]);
      await admin.query('DELETE FROM academic_years WHERE id = ANY($1::uuid[])', [[yearA, yearB]]);
      await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[tenantA, tenantB]]);
      await app.end();
      await admin.end();
    }
  });
});

describe.skipIf(dbAvailable || forceLive)('F-016 live payment_reconciliations RLS (skipped)', () => {
  it('skips live isolation when PostgreSQL is unavailable', () => {
    expect(dbAvailable).toBe(false);
  });
});
