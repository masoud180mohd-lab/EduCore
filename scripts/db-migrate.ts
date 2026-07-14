import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');

type Direction = 'up' | 'down';

function resolveDatabaseUrl(): string {
  const fromEnv = process.env['DATABASE_URL'];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  // Local DEV-001 aligned defaults (never for production).
  const user = process.env['POSTGRES_USER'] ?? 'educore';
  const password = process.env['POSTGRES_PASSWORD'] ?? 'educore_local_only';
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function listMigrationIds(): string[] {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.up.sql'));
  return files.map((name) => name.replace(/\.up\.sql$/u, '')).sort((a, b) => a.localeCompare(b));
}

async function ensureLedger(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Best-effort grants for local multi-role DX (ignore if not owner / insufficient privilege).
  await client.query(`
    DO $do$
    BEGIN
      BEGIN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore_migrator;
      EXCEPTION WHEN undefined_object OR insufficient_privilege THEN
        NULL;
      END;
      BEGIN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore;
      EXCEPTION WHEN undefined_object OR insufficient_privilege THEN
        NULL;
      END;
      BEGIN
        GRANT SELECT ON TABLE schema_migrations TO educore_app;
      EXCEPTION WHEN undefined_object OR insufficient_privilege THEN
        NULL;
      END;
    END
    $do$;
  `);
}

async function appliedIds(client: pg.Client): Promise<Set<string>> {
  const result = await client.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((row) => row.id));
}

async function migrateUp(client: pg.Client): Promise<string[]> {
  await ensureLedger(client);
  const applied = await appliedIds(client);
  const appliedNow: string[] = [];

  for (const id of listMigrationIds()) {
    if (applied.has(id)) {
      continue;
    }

    const sqlPath = path.join(migrationsDir, `${id}.up.sql`);
    const sql = readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      appliedNow.push(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  return appliedNow;
}

async function migrateDown(client: pg.Client): Promise<string | undefined> {
  await ensureLedger(client);
  const result = await client.query<{ id: string }>(
    'SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );
  const last = result.rows[0]?.id;
  if (last === undefined) {
    return undefined;
  }

  const sqlPath = path.join(migrationsDir, `${last}.down.sql`);
  const sql = readFileSync(sqlPath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [last]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return last;
}

async function main(): Promise<void> {
  const direction: Direction = process.argv.includes('--down') ? 'down' : 'up';
  const databaseUrl = resolveDatabaseUrl();

  // Never print the full URL (may contain passwords).
  process.stdout.write(`Running db migrate ${direction} (url redacted).\n`);

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connection failed';
    process.stderr.write(
      `Database connection failed (is Docker Postgres up?). Details redacted: ${message.split('\n')[0]}\n`,
    );
    process.exitCode = 2;
    return;
  }

  try {
    if (direction === 'up') {
      const applied = await migrateUp(client);
      if (applied.length === 0) {
        process.stdout.write('No pending migrations.\n');
      } else {
        process.stdout.write(`Applied: ${applied.join(', ')}\n`);
      }
    } else {
      const rolled = await migrateDown(client);
      if (rolled === undefined) {
        process.stdout.write('No migrations to roll back.\n');
      } else {
        process.stdout.write(`Rolled back: ${rolled}\n`);
      }
    }
  } finally {
    await client.end();
  }
}

void main();
