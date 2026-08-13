/**
 * Enroll active TOTP for prod seed admin under MFA_ENFORCE=soft.
 * Writes otpauth URI to .local/ (gitignored). Never prints secret/password/token.
 *
 * Usage: CONFIRM=YES node scripts/ops-prd-mfa-enroll.mjs
 */
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CONFIG = 'prd';
const API = 'https://educore-api.fly.dev';
const PERIOD_SECONDS = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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

function fromBase32(secret) {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 secret.');
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
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function jsonFetch(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text === '' ? null : JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main() {
  if ((process.env['CONFIRM'] ?? '').trim().toUpperCase() !== 'YES') {
    process.stderr.write('Refusing enroll without CONFIRM=YES.\n');
    process.exit(2);
  }

  const email = getSecret('SEED_ADMIN_EMAIL');
  const password = getSecret('SEED_ADMIN_PASS');
  if (!email || !password) {
    process.stderr.write('SEED_ADMIN_EMAIL or SEED_ADMIN_PASS missing in educore/prd\n');
    process.exit(1);
  }

  const login = await jsonFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 200 || !login.body?.data?.accessToken) {
    process.stderr.write(
      `login_failed status=${login.status} code=${login.body?.error?.code ?? 'unknown'}\n`,
    );
    process.exit(1);
  }
  const token = login.body.data.accessToken;
  const tenantId = login.body.data.tenantId;
  process.stdout.write('login=ok\n');

  const begin = await jsonFetch('/api/v1/me/mfa-factors', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'idempotency-key': `prd-mfa-enroll-${randomUUID()}`,
    },
    body: JSON.stringify({ factorType: 'totp', label: 'prod-admin' }),
  });
  const secret = begin.body?.data?.secret;
  const otpauthUri = begin.body?.data?.otpauthUri;
  const factorId = begin.body?.data?.id;
  if (begin.status !== 201 || typeof secret !== 'string' || typeof factorId !== 'string') {
    process.stderr.write(
      `enroll_begin_failed status=${begin.status} code=${begin.body?.error?.code ?? 'unknown'}\n`,
    );
    process.exit(1);
  }

  const code = generateTotpCode(secret);
  const confirm = await jsonFetch(`/api/v1/me/mfa-factors/${factorId}/confirm`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({ code }),
  });
  if (confirm.status !== 200 || confirm.body?.data?.status !== 'active') {
    process.stderr.write(
      `enroll_confirm_failed status=${confirm.status} code=${confirm.body?.error?.code ?? 'unknown'}\n`,
    );
    process.exit(1);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, '.local');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'prod-admin-totp.otpauth.txt');
  writeFileSync(outFile, `${otpauthUri}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`factor_status=active\n`);
  process.stdout.write(`otpauth_file=.local/prod-admin-totp.otpauth.txt\n`);
  process.stdout.write('Scan that file into authenticator before MFA_ENFORCE=hard.\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
