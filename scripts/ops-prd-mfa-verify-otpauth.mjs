/**
 * Prove prod login MFA verify works using otpauth file (no secret print).
 * Usage: node scripts/ops-prd-mfa-verify-otpauth.mjs
 */
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://educore-api.fly.dev';
const PERIOD_SECONDS = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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

function fromBase32(secret) {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTotpCode(secretBase32, atMs = Date.now()) {
  const key = fromBase32(secretBase32);
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uri = readFileSync(join(root, '.local', 'prod-admin-totp.otpauth.txt'), 'utf8').trim();
const secret = new URL(uri).searchParams.get('secret');
if (!secret) {
  process.stderr.write('otpauth missing secret\n');
  process.exit(1);
}

const email = getSecret('SEED_ADMIN_EMAIL');
const password = getSecret('SEED_ADMIN_PASS');
const login = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'accept': 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginBody = await login.json();
const challenge = loginBody.data?.mfaChallengeToken;
process.stdout.write(
  `login_http=${login.status} requiresMfa=${loginBody.data?.requiresMfa === true}\n`,
);
if (!challenge) {
  process.stderr.write('no_challenge\n');
  process.exit(1);
}
const verify = await fetch(`${API}/api/v1/auth/mfa/verify`, {
  method: 'POST',
  headers: { 'accept': 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify({ mfaChallengeToken: challenge, code: generateTotpCode(secret) }),
});
const verifyBody = await verify.json();
process.stdout.write(
  `verify_http=${verify.status} hasToken=${Boolean(verifyBody.data?.accessToken)} code=${verifyBody.error?.code ?? 'ok'}\n`,
);
process.exit(verify.status === 200 && verifyBody.data?.accessToken ? 0 : 1);
