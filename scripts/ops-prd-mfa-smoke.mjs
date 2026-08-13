/**
 * Prod MFA-hard smoke: privileged password login must not mint a session.
 * Prints flags only — no tokens, emails, or codes.
 */
import { spawnSync } from 'node:child_process';

const API = 'https://educore-api.fly.dev';

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'prd'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

const email = getSecret('SEED_ADMIN_EMAIL');
const password = getSecret('SEED_ADMIN_PASS');
if (!email || !password) {
  process.stderr.write('SEED_ADMIN_* missing\n');
  process.exit(1);
}

const res = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  headers: { accept: 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const body = await res.json().catch(() => ({}));
const data = body.data ?? {};
process.stdout.write(`http=${res.status}\n`);
process.stdout.write(`requiresMfa=${data.requiresMfa === true}\n`);
process.stdout.write(`hasAccessToken=${Boolean(data.accessToken)}\n`);
process.stdout.write(`hasChallenge=${Boolean(data.mfaChallengeToken)}\n`);
if (data.requiresMfa === true && !data.accessToken && data.mfaChallengeToken) {
  process.stdout.write('smoke=pass\n');
  process.exit(0);
}
process.stdout.write('smoke=fail\n');
process.exit(1);
