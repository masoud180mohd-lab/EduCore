import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrapSqlPath = path.join(projectRoot, 'apps/api/db/bootstrap/001_roles.sql');

function resolveDatabaseUrl(): string {
  const fromEnv = process.env['DATABASE_URL'];
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }

  const user = process.env['POSTGRES_USER'] ?? 'educore';
  const password = process.env['POSTGRES_PASSWORD'] ?? 'educore_local_only';
  const host = process.env['POSTGRES_HOST'] ?? '127.0.0.1';
  const port = process.env['POSTGRES_HOST_PORT'] ?? process.env['POSTGRES_PORT'] ?? '5432';
  const database = process.env['POSTGRES_DB'] ?? 'educore';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function main(): Promise<void> {
  const sql = readFileSync(bootstrapSqlPath, 'utf8');
  const client = new Client({ connectionString: resolveDatabaseUrl() });

  process.stdout.write(
    'Bootstrapping educore_migrator + educore_app + educore_platform roles (url redacted).\n',
  );

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
    await client.query(sql);
    process.stdout.write('Role bootstrap completed.\n');
    process.stdout.write(
      'Reminder: NestJS request pool is educore_app; ClickPesa ingest is educore_webhook; never migrator/platform/superuser.\n',
    );
  } finally {
    await client.end();
  }
}

void main();
