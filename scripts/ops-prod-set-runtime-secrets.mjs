/**
 * Production Doppler `educore`/`prd` runtime secrets. Does not print values.
 * Does not enable ClickPesa. Does not stamp Board GO.
 *
 * Usage:
 *   doppler run --project educore --config prd -- node scripts/ops-prod-set-runtime-secrets.mjs
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const CONFIG = 'prd';

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--silent', '--project', 'educore', '--config', CONFIG],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
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
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', CONFIG],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const databaseUrl = process.env['DATABASE_URL']?.trim() ?? getSecret('DATABASE_URL');
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL missing in educore/prd.\n');
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

if (!getSecret('EDUCORE_APP_DATABASE_URL')) {
  setSecret('EDUCORE_APP_DATABASE_URL', appUrl);
} else {
  process.stdout.write('keep EDUCORE_APP_DATABASE_URL (already set)\n');
}

setSecret('EDUCORE_ENABLE_APP_DB', '1');
setSecret('NODE_ENV', 'production');
setSecret('PAYMENT_PROVIDER', 'fake');
setSecret('SMS_PROVIDER', 'fake');
setSecret('AI_PROVIDER', 'fake');
if (!getSecret('AUTH_IDP_PROVIDER')) {
  setSecret('AUTH_IDP_PROVIDER', 'local');
} else {
  process.stdout.write('keep AUTH_IDP_PROVIDER (already set)\n');
}

if (!getSecret('MFA_ENFORCE')) {
  setSecret('MFA_ENFORCE', 'soft');
} else {
  process.stdout.write('keep MFA_ENFORCE (already set)\n');
}

if (!getSecret('MFA_TOTP_ENCRYPTION_KEY')) {
  setSecret('MFA_TOTP_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
} else {
  process.stdout.write('keep MFA_TOTP_ENCRYPTION_KEY (already set)\n');
}

if (!getSecret('SEED_PLATFORM_DATABASE_URL')) {
  const platform = new URL(databaseUrl);
  platform.username = 'educore_platform';
  platform.password = 'educore_platform_local_only';
  setSecret('SEED_PLATFORM_DATABASE_URL', platform.toString());
} else {
  process.stdout.write('keep SEED_PLATFORM_DATABASE_URL (already set)\n');
}

setSecret('SEED_ADMIN_ALLOW_PRODUCTION', '1');
setSecret('SEED_ADMIN_EMAIL', 'admin@educore.prod');
setSecret('SEED_TENANT_CODE', 'prod-school');
setSecret('SEED_TENANT_NAME', 'EduCore Production School');
setSecret('SEED_ADMIN_RESET', '1');

if (!getSecret('SEED_ADMIN_PASS')) {
  setSecret('SEED_ADMIN_PASS', randomBytes(18).toString('base64url'));
} else {
  process.stdout.write('keep SEED_ADMIN_PASS (already set)\n');
}

process.stdout.write('Runtime secrets ready for educore/prd (PAYMENT_PROVIDER=fake).\n');
process.stdout.write(
  'Retrieve prod admin password locally: doppler secrets get SEED_ADMIN_PASS --plain --project educore --config prd\n',
);
process.stdout.write('Rotate DB role passwords before any school traffic (ops-stg-rotate pattern).\n');
