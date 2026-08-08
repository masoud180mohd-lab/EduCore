/**
 * Push selected Doppler educore/stg secrets to Fly app educore-api-staging.
 * Does not print secret values. Omits DATABASE_URL (owner/migrator) from Fly.
 *
 * Usage: node scripts/ops-stg-sync-fly-secrets.mjs
 */
import { spawnSync } from 'node:child_process';

const APP = 'educore-api-staging';
const NAMES = [
  'EDUCORE_APP_DATABASE_URL',
  'EDUCORE_ENABLE_APP_DB',
  'NODE_ENV',
  'MFA_ENFORCE',
  'MFA_TOTP_ENCRYPTION_KEY',
  'PAYMENT_PROVIDER',
  'SMS_PROVIDER',
  'AI_PROVIDER',
];

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'stg'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    process.stderr.write(`Missing Doppler secret ${name}\n`);
    process.exit(1);
  }
  return (r.stdout || '').trim();
}

function setFlySecret(name, value) {
  const r = spawnSync('flyctl', ['secrets', 'set', `${name}=-`, '-a', APP], {
    input: value,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (r.status !== 0) {
    // Fallback: KEY=value (may break on & — prefer stdin form)
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

for (const name of NAMES) {
  setFlySecret(name, getSecret(name));
}

process.stdout.write(`Fly secrets synced to ${APP} (no owner DATABASE_URL).\n`);
