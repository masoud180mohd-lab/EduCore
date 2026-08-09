/**
 * Ensure Doppler educore/stg has platform URL + staging admin seed vars (names only logged).
 * Does not print secret values.
 *
 * Usage: doppler run --project educore --config stg -- node scripts/ops-stg-prepare-admin-seed.mjs
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--project', 'educore', '--config', 'stg'],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    process.stderr.write(`Failed ${name}: ${(r.stderr || r.stdout || '').trim()}\n`);
    process.exit(1);
  }
  process.stdout.write(`set ${name}\n`);
}

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'stg'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const databaseUrl = process.env['DATABASE_URL']?.trim();
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL missing\n');
  process.exit(1);
}

if (!getSecret('SEED_PLATFORM_DATABASE_URL')) {
  const platform = new URL(databaseUrl);
  platform.username = 'educore_platform';
  platform.password = 'educore_platform_local_only';
  setSecret('SEED_PLATFORM_DATABASE_URL', platform.toString());
  process.stdout.write(
    'SEED_PLATFORM_DATABASE_URL set to bootstrap lab password — run ops-stg-rotate-db-passwords.mjs before production-like use\n',
  );
} else {
  process.stdout.write('keep SEED_PLATFORM_DATABASE_URL (already set)\n');
}

setSecret('SEED_ADMIN_ALLOW_PRODUCTION', '1');
setSecret('SEED_ADMIN_EMAIL', 'admin@educore.staging');
setSecret('SEED_TENANT_CODE', 'staging-school');
setSecret('SEED_TENANT_NAME', 'EduCore Staging School');
setSecret('SEED_ADMIN_RESET', '1');

if (!getSecret('SEED_ADMIN_PASS')) {
  // URL-safe-ish; 24 bytes → base64url without padding noise for typing
  const pass = randomBytes(18).toString('base64url');
  setSecret('SEED_ADMIN_PASS', pass);
} else {
  process.stdout.write('keep SEED_ADMIN_PASS (already set)\n');
}

process.stdout.write('Seed vars ready. Retrieve password locally with:\n');
process.stdout.write('  doppler secrets get SEED_ADMIN_PASS --plain --project educore --config stg\n');
