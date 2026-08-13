import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const { Client } = pg;

/**
 * F-017 — educore_app must not EXECUTE MoMo money-posting SECURITY DEFINER helpers.
 * ingest is educore_webhook only; complete is definer-internal.
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

function roleUrl(role: 'educore_app' | 'educore_webhook', password: string): string {
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

const dbAvailable = await canConnect(adminUrl());

describe.skipIf(!dbAvailable && !forceLive)('F-017 live MoMo SECURITY DEFINER EXECUTE', () => {
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
      const appOk = await canConnect(roleUrl('educore_app', 'educore_app_local_only'));
      const webhookOk = await canConnect(roleUrl('educore_webhook', 'educore_webhook_local_only'));
      if (!appOk || !webhookOk) {
        throw new Error(`db:bootstrap-roles failed: ${bootstrap.stderr || bootstrap.stdout}`);
      }
    }
  }, 120_000);

  it('educore_app cannot EXECUTE complete_pending_mobile_money_payment', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    await app.connect();
    try {
      await expect(
        app.query(
          `SELECT app.complete_pending_mobile_money_payment($1::uuid, $2::uuid, $3::uuid)`,
          [randomUUID(), randomUUID(), randomUUID()],
        ),
      ).rejects.toSatisfy((error: unknown) => pgCode(error) === '42501');
    } finally {
      await app.end();
    }
  });

  it('educore_app cannot EXECUTE ingest_clickpesa_gateway_event', async () => {
    const app = new Client({
      connectionString: roleUrl('educore_app', 'educore_app_local_only'),
    });
    await app.connect();
    try {
      await expect(
        app.query(
          `SELECT * FROM app.ingest_clickpesa_gateway_event(
             $1::uuid, $2::text, $3::text, $4::uuid, $5::bigint, $6::text, $7::uuid
           )`,
          [randomUUID(), 'evt-1', 'a'.repeat(64), randomUUID(), 1000, 'succeeded', randomUUID()],
        ),
      ).rejects.toSatisfy((error: unknown) => pgCode(error) === '42501');
    } finally {
      await app.end();
    }
  });

  it('educore_webhook can EXECUTE ingest but not complete', async () => {
    const webhook = new Client({
      connectionString: roleUrl('educore_webhook', 'educore_webhook_local_only'),
    });
    await webhook.connect();
    try {
      const ingest = await webhook.query<{ detail: string }>(
        `SELECT detail FROM app.ingest_clickpesa_gateway_event(
           $1::uuid, $2::text, $3::text, $4::uuid, $5::bigint, $6::text, $7::uuid
         )`,
        [randomUUID(), 'evt-f017', 'b'.repeat(64), randomUUID(), 1000, 'succeeded', randomUUID()],
      );
      expect(ingest.rows[0]?.detail).toBe('attempt_not_found');

      await expect(
        webhook.query(
          `SELECT app.complete_pending_mobile_money_payment($1::uuid, $2::uuid, $3::uuid)`,
          [randomUUID(), randomUUID(), randomUUID()],
        ),
      ).rejects.toSatisfy((error: unknown) => pgCode(error) === '42501');
    } finally {
      await webhook.end();
    }
  });
});

describe.skipIf(dbAvailable || forceLive)(
  'F-017 live MoMo SECURITY DEFINER EXECUTE (skipped)',
  () => {
    it('skips live isolation when PostgreSQL is unavailable', () => {
      expect(dbAvailable).toBe(false);
    });
  },
);
