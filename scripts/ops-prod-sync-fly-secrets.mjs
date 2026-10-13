/**
 * Push selected Doppler educore/prd secrets to Fly app educore-api.
 * Does not print secret values. Omits DATABASE_URL (owner/migrator) from Fly.
 *
 * Usage: node scripts/ops-prod-sync-fly-secrets.mjs
 */
import { spawnSync } from 'node:child_process';

const APP = 'educore-api';
const CONFIG = 'prd';
const CORE_NAMES = [
  'EDUCORE_APP_DATABASE_URL',
  'EDUCORE_ENABLE_APP_DB',
  'NODE_ENV',
  'MFA_ENFORCE',
  'MFA_TOTP_ENCRYPTION_KEY',
  'PAYMENT_PROVIDER',
  'SMS_PROVIDER',
  'AI_PROVIDER',
  'AUTH_IDP_PROVIDER',
];

function getSecret(name, { required }) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', CONFIG],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    if (!required) return undefined;
    process.stderr.write(`Missing Doppler secret ${name}\n`);
    process.exit(1);
  }
  const value = (r.stdout || '').trim();
  if (value === '' && required) {
    process.stderr.write(`Empty Doppler secret ${name}\n`);
    process.exit(1);
  }
  return value === '' ? undefined : value;
}

function setFlySecret(name, value) {
  const r = spawnSync('flyctl', ['secrets', 'set', `${name}=-`, '-a', APP], {
    input: value,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (r.status !== 0) {
    const r2 = spawnSync('flyctl', ['secrets', 'set', '-a', APP, `${name}=${value}`], {
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    if (r2.status !== 0) {
      process.stderr.write(
        `Failed Fly secret ${name}: ${(r.stderr || r2.stderr || r.stdout || r2.stdout || 'unknown').trim()}\n`,
      );
      process.exit(1);
    }
  }
  process.stdout.write(`fly set ${name}\n`);
}

for (const name of CORE_NAMES) {
  setFlySecret(name, getSecret(name, { required: true }));
}

process.stdout.write(
  `Fly secrets synced to ${APP} (no owner DATABASE_URL; Auth0 not auto-copied).\n`,
);
