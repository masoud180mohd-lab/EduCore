/**
 * Rotate staging Postgres role passwords and refresh Doppler URLs.
 * Does not print secret values.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-rotate-db-passwords.mjs
 *   node scripts/ops-stg-sync-fly-secrets.mjs
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import pg from 'pg';

const CONFIG =
  process.env['DOPPLER_TARGET_CONFIG']?.trim() ||
  process.env['DOPPLER_CONFIG']?.trim() ||
  'stg';

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--silent', '--project', 'educore', '--config', CONFIG],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    throw new Error(`doppler set ${name} failed: ${(r.stderr || r.stdout || '').trim()}`);
  }
  process.stdout.write(`set ${name}\n`);
}

function genPass() {
  return randomBytes(24).toString('base64url');
}

function rebuildUrl(baseUrl, username, password) {
  const u = new URL(baseUrl);
  u.username = username;
  u.password = password;
  return u.toString();
}

async function alterPassword(client, role, password) {
  const allowed = new Set(['educore_app', 'educore_platform', 'educore_migrator', 'neondb_owner']);
  if (!allowed.has(role)) {
    throw new Error(`refusing to alter unexpected role: ${role}`);
  }
  // PASSWORD cannot use bind params on all PG/Neon paths — escape literally.
  const lit = client.escapeLiteral(password);
  await client.query(`ALTER ROLE ${role} WITH PASSWORD ${lit}`);
}

async function main() {
  const ownerUrl = process.env['DATABASE_URL']?.trim();
  if (!ownerUrl) {
    throw new Error('DATABASE_URL required');
  }
  if (CONFIG !== 'stg' && CONFIG !== 'prd') {
    throw new Error(`refusing Doppler config ${CONFIG} (expected stg or prd)`);
  }
  process.stdout.write(`Doppler target config=${CONFIG}\n`);

  const ownerName = decodeURIComponent(new URL(ownerUrl).username || 'neondb_owner');
  const passApp = genPass();
  const passPlatform = genPass();
  const passMigrator = genPass();
  const passOwner = genPass();

  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  process.stdout.write(`connected; rotating passwords (owner role=${ownerName})…\n`);

  await alterPassword(client, 'educore_app', passApp);
  await alterPassword(client, 'educore_platform', passPlatform);
  await alterPassword(client, 'educore_migrator', passMigrator);

  if (ownerName === 'neondb_owner') {
    const lit = client.escapeLiteral(passOwner);
    await client.query(`ALTER ROLE neondb_owner WITH PASSWORD ${lit}`);
  } else if (ownerName.endsWith('_owner')) {
    const ident = `"${ownerName.replaceAll('"', '""')}"`;
    const lit = client.escapeLiteral(passOwner);
    await client.query(`ALTER ROLE ${ident} WITH PASSWORD ${lit}`);
  } else {
    process.stdout.write('skip owner password rotate (unexpected owner username)\n');
  }

  await client.end().catch(() => undefined);
  process.stdout.write('Neon ALTER ROLE complete\n');

  const newOwnerUrl =
    ownerName === 'neondb_owner' || ownerName.endsWith('_owner')
      ? rebuildUrl(ownerUrl, ownerName, passOwner)
      : ownerUrl;
  const newAppUrl = rebuildUrl(ownerUrl, 'educore_app', passApp);
  const newPlatformUrl = rebuildUrl(ownerUrl, 'educore_platform', passPlatform);

  const probe = new pg.Client({ connectionString: newAppUrl });
  await probe.connect();
  const who = await probe.query('select current_user as u');
  await probe.end();
  if (who.rows[0].u !== 'educore_app') {
    throw new Error('app role probe failed');
  }
  process.stdout.write('app role probe OK\n');

  const ownerProbe = new pg.Client({ connectionString: newOwnerUrl });
  await ownerProbe.connect();
  await ownerProbe.query('select 1');
  await ownerProbe.end();
  process.stdout.write('owner URL probe OK\n');

  setSecret('DATABASE_URL', newOwnerUrl);
  setSecret('EDUCORE_APP_DATABASE_URL', newAppUrl);
  setSecret('SEED_PLATFORM_DATABASE_URL', newPlatformUrl);

  process.stdout.write(`Doppler ${CONFIG} updated.\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
