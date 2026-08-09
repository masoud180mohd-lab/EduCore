/**
 * Push selected Doppler educore/stg secrets to Fly app educore-api-staging.
 * Does not print secret values. Omits DATABASE_URL (owner/migrator) from Fly.
 *
 * Auth0 secrets sync only when AUTH_IDP_PROVIDER=auth0 (or AUTH0_DOMAIN is set).
 *
 * Usage: node scripts/ops-stg-sync-fly-secrets.mjs
 */
import { spawnSync } from 'node:child_process';

const APP = 'educore-api-staging';
const CORE_NAMES = [
  'EDUCORE_APP_DATABASE_URL',
  'EDUCORE_ENABLE_APP_DB',
  'NODE_ENV',
  'MFA_ENFORCE',
  'MFA_TOTP_ENCRYPTION_KEY',
  'PAYMENT_PROVIDER',
  'SMS_PROVIDER',
  'AI_PROVIDER',
];

const AUTH0_NAMES = [
  'AUTH_IDP_PROVIDER',
  'AUTH0_DOMAIN',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
];

function getSecret(name, { required }) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'stg'],
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

const idp = getSecret('AUTH_IDP_PROVIDER', { required: false }) ?? 'local';
const auth0Domain = getSecret('AUTH0_DOMAIN', { required: false });
const syncAuth0 = idp === 'auth0' || Boolean(auth0Domain);

if (syncAuth0) {
  for (const name of AUTH0_NAMES) {
    const value = getSecret(name, { required: name !== 'AUTH0_CLIENT_SECRET' || idp === 'auth0' });
    if (value !== undefined) {
      setFlySecret(name, value);
    } else if (name === 'AUTH_IDP_PROVIDER') {
      setFlySecret(name, idp);
    } else {
      process.stderr.write(`Missing Doppler secret ${name} (required for Auth0 sync)\n`);
      process.exit(1);
    }
  }
} else {
  process.stdout.write('skip Auth0 Fly secrets (AUTH_IDP_PROVIDER!=auth0 and AUTH0_DOMAIN unset)\n');
}

process.stdout.write(`Fly secrets synced to ${APP} (no owner DATABASE_URL).\n`);
