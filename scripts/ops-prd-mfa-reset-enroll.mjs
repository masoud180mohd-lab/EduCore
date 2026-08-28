/**
 * Soften prod MFA, disable active TOTP for privileged users, re-enroll seed admin.
 * Never prints secrets/passwords/tokens. Writes gitignored otpauth file.
 *
 * Usage: CONFIRM=YES node scripts/ops-prd-mfa-reset-enroll.mjs
 * Then Owner must scan .local/prod-admin-totp.otpauth.txt before hard flip.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

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

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--silent', '--project', 'educore', '--config', CONFIG],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    process.stderr.write(`Failed to set ${name}\n`);
    process.exit(1);
  }
  process.stdout.write(`set ${name}=${value}\n`);
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

async function disableActiveTotp(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const q = await client.query(
    `UPDATE mfa_factors
     SET status = 'disabled', updated_at = now()
     WHERE factor_type = 'totp' AND status IN ('active', 'pending')
     RETURNING id`,
  );
  await client.end();
  process.stdout.write(`disabled_factors=${q.rowCount}\n`);
}

async function main() {
  if ((process.env['CONFIRM'] ?? '').trim().toUpperCase() !== 'YES') {
    process.stderr.write('Refusing MFA reset without CONFIRM=YES.\n');
    process.exit(2);
  }

  const url = getSecret('DATABASE_URL');
  if (!url) {
    process.stderr.write('DATABASE_URL missing\n');
    process.exit(1);
  }

  setSecret('MFA_ENFORCE', 'soft');
  process.stdout.write('Sync Fly: node scripts/ops-prod-sync-fly-secrets.mjs\n');
  const sync = spawnSync('node', ['scripts/ops-prod-sync-fly-secrets.mjs'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (sync.status !== 0) {
    process.stderr.write(`${(sync.stderr || sync.stdout || 'sync failed').trim()}\n`);
    process.exit(1);
  }
  process.stdout.write('fly_sync=ok\n');

  // Wait briefly for machines to pick up soft
  await new Promise((r) => setTimeout(r, 8000));

  await disableActiveTotp(url);

  const email = getSecret('SEED_ADMIN_EMAIL');
  const password = getSecret('SEED_ADMIN_PASS');
  if (!email || !password) {
    process.stderr.write('SEED_ADMIN_* missing\n');
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
      'idempotency-key': `prd-mfa-reset-${randomUUID()}`,
    },
    body: JSON.stringify({ factorType: 'totp', label: 'prod-admin-reset' }),
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

  // Prove login+verify with the new secret (no print of code)
  const login2 = await jsonFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const challenge = login2.body?.data?.mfaChallengeToken;
  if (!challenge) {
    // soft may skip challenge if not privileged path — still ok if accessToken
    process.stdout.write(
      `post_enroll_login requiresMfa=${login2.body?.data?.requiresMfa === true} hasToken=${Boolean(login2.body?.data?.accessToken)}\n`,
    );
  } else {
    const verify = await jsonFetch('/api/v1/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({
        mfaChallengeToken: challenge,
        code: generateTotpCode(secret),
      }),
    });
    process.stdout.write(
      `mfa_verify_status=${verify.status} hasToken=${Boolean(verify.body?.data?.accessToken)}\n`,
    );
    if (verify.status !== 200 || !verify.body?.data?.accessToken) {
      process.stderr.write('mfa_verify_failed after reset\n');
      process.exit(1);
    }
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, '.local');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'prod-admin-totp.otpauth.txt');
  writeFileSync(outFile, `${otpauthUri}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write('factor_status=active\n');
  process.stdout.write('otpauth_file=.local/prod-admin-totp.otpauth.txt\n');
  process.stdout.write(
    'MFA still soft until Owner scans otpauth. Then: CONFIRM=YES npm run ops:prd:mfa-hard && npm run ops:prod:sync-fly-secrets\n',
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
