/**
 * Print applied 20260813* migrations + bursar presence. No secrets, no emails.
 * Usage: DOPPLER_CONFIG=stg node scripts/ops-migration-glance.mjs
 */
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const CONFIG = (process.env['DOPPLER_CONFIG'] ?? 'stg').trim();

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', CONFIG],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const url = getSecret('DATABASE_URL');
if (!url) {
  process.stderr.write(`DATABASE_URL missing in educore/${CONFIG}\n`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const mig = await client.query(
  `SELECT id FROM schema_migrations WHERE id LIKE '20260813%' ORDER BY id`,
);
const bursar = await client.query(
  `SELECT count(*)::int AS n FROM roles WHERE code = 'bursar' AND is_system = true`,
);
const webhook = await client.query(
  `SELECT exists(SELECT 1 FROM pg_roles WHERE rolname = 'educore_webhook') AS ok`,
);
await client.end();

process.stdout.write(`config=${CONFIG}\n`);
process.stdout.write(`aug13_migrations=${mig.rows.map((r) => r.id).join(',') || '(none)'}\n`);
process.stdout.write(`bursar_system_role=${bursar.rows[0].n}\n`);
process.stdout.write(`educore_webhook_role=${webhook.rows[0].ok}\n`);
