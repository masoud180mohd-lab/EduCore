/**
 * OPS staging secret bootstrap — sets Doppler `educore`/`stg` runtime secrets
 * without printing secret values. Uses DATABASE_URL already in Doppler.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-set-runtime-secrets.mjs
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

function setSecret(name, value) {
  // Pass value on stdin so `&` / `?` in Neon URLs are not eaten by Windows shells.
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--project', 'educore', '--config', 'stg'],
    {
      input: value,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    },
  );
  if (r.status !== 0) {
    process.stderr.write(`Failed to set ${name}: ${(r.stderr || r.stdout || 'unknown').trim()}\n`);
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
  if (r.status !== 0) {
    return undefined;
  }
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const databaseUrl = process.env['DATABASE_URL']?.trim();
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL missing in environment (run via doppler run).\n');
  process.exit(1);
}

let appUrl;
try {
  const u = new URL(databaseUrl);
  u.username = 'educore_app';
  u.password = 'educore_app_local_only';
  appUrl = u.toString();
} catch {
  process.stderr.write('DATABASE_URL is not a valid URL.\n');
  process.exit(1);
}

setSecret('EDUCORE_APP_DATABASE_URL', appUrl);
setSecret('EDUCORE_ENABLE_APP_DB', '1');
setSecret('NODE_ENV', 'production');
setSecret('MFA_ENFORCE', 'soft');
setSecret('PAYMENT_PROVIDER', 'fake');
setSecret('SMS_PROVIDER', 'fake');
setSecret('AI_PROVIDER', 'fake');

const existingMfa = getSecret('MFA_TOTP_ENCRYPTION_KEY');
if (existingMfa) {
  process.stdout.write('keep MFA_TOTP_ENCRYPTION_KEY (already set)\n');
} else {
  setSecret('MFA_TOTP_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
}

process.stdout.write('Runtime secrets ready for educore/stg.\n');
process.stdout.write(
  'Note: educore_app still uses bootstrap lab password — rotate before any real pilot.\n',
);
