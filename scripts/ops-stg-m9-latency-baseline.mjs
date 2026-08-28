/**
 * M9-004 — SLO-3 p95 latency baseline sample (staging, light load).
 *
 * Logs in as the staging seed admin (password + locally generated TOTP from
 * the encrypted DB factor), then samples core authenticated GETs and /health.
 * Writes an evidence task-record with p50/p95/max. Prints no secret values,
 * tokens, emails, or learner data.
 *
 * Client-side timing from the operator machine to FRA — record says so.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-m9-latency-baseline.mjs
 */
import { createDecipheriv, createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const DEFAULT_API_BASE = 'https://educore-api-staging.fly.dev';
const APPROVED_HOSTS = new Set(['educore-api-staging.fly.dev']);
const TIMEOUT_MS = 15_000;
const WARMUP = 3;
const SAMPLES = 25;
const GAP_MS = 150;
const SLO3_P95_MS = 800;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stagingApiBase() {
  const raw = process.env['EDUCORE_STAGING_API'] ?? DEFAULT_API_BASE;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('EDUCORE_STAGING_API must be a valid URL');
  }
  if (url.protocol !== 'https:' || !APPROVED_HOSTS.has(url.hostname)) {
    throw new Error('EDUCORE_STAGING_API must use an approved staging Fly HTTPS host');
  }
  return url.origin;
}

// --- TOTP (RFC 6238, SHA-1, 30s, 6 digits) — mirrors apps/api auth/totp.ts ---
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function fromBase32(secret) {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
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

function totpCode(secretBase32, atMs = Date.now()) {
  const key = fromBase32(secretBase32);
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** 6).padStart(6, '0');
}

// --- TOTP factor decryption — mirrors apps/api auth/mfa-crypto.ts ---
function loadEncryptionKey() {
  const raw = (process.env['MFA_TOTP_ENCRYPTION_KEY'] ?? '').trim();
  if (raw === '') return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const buf = Buffer.from(raw, 'base64');
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

function decryptTotpSecret(payload, key) {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid encrypted TOTP payload.');
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// --- staging DB lookups (owner role; prints no values) ---
async function resolveAdminContext(email) {
  const url = process.env['DATABASE_URL']?.trim();
  if (!url) throw new Error('DATABASE_URL required');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const userQ = await client.query(
      `SELECT u.id, tm.tenant_id
       FROM users u
       INNER JOIN tenant_memberships tm
         ON tm.user_id = u.id AND tm.status = 'active'
       WHERE lower(u.email) = lower($1)
       ORDER BY tm.created_at
       LIMIT 1`,
      [email],
    );
    if (userQ.rows.length === 0) throw new Error('seed admin user or active membership not found');
    const { id: userId, tenant_id: tenantId } = userQ.rows[0];
    const factorQ = await client.query(
      `SELECT secret_encrypted FROM mfa_factors
       WHERE user_id = $1 AND factor_type = 'totp' AND status = 'active'
       LIMIT 1`,
      [userId],
    );
    if (factorQ.rows.length === 0) throw new Error('no active TOTP factor for seed admin');
    return { userId, tenantId, secretEncrypted: factorQ.rows[0].secret_encrypted };
  } finally {
    await client.end().catch(() => undefined);
  }
}

// --- HTTP helpers ---
async function timedFetch(url, options = {}) {
  const startedAt = performance.now();
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', ...(options.headers ?? {}) },
  });
  const durationMs = Math.round(performance.now() - startedAt);
  return { res, durationMs };
}

async function loginAndVerify(base, email, password, tenantId, totpSecret) {
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (login.status !== 200) throw new Error(`login failed (http ${login.status})`);
  const loginBody = await login.json();
  const data = loginBody?.data ?? {};
  if (!data.requiresMfa || !data.mfaChallengeToken) {
    if (data.accessToken) return data.accessToken;
    throw new Error('unexpected login shape (no MFA challenge, no token)');
  }
  const verify = await fetch(`${base}/api/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ mfaChallengeToken: data.mfaChallengeToken, code: totpCode(totpSecret) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (verify.status !== 200) throw new Error(`mfa verify failed (http ${verify.status})`);
  const token = (await verify.json())?.data?.accessToken;
  if (!token) throw new Error('mfa verify returned no access token');
  return token;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function sampleEndpoint(name, url, headers) {
  const durations = [];
  let lastStatus = 'error';
  for (let i = 0; i < WARMUP + SAMPLES; i += 1) {
    try {
      const { res, durationMs } = await timedFetch(url, { headers });
      lastStatus = String(res.status);
      if (res.ok) {
        await res.arrayBuffer();
        if (i >= WARMUP) durations.push(durationMs);
      } else {
        throw new Error(`http ${res.status}`);
      }
    } catch (error) {
      if (i >= WARMUP) {
        return {
          name,
          samples: durations,
          failed: true,
          lastStatus,
          detail: String(error.message ?? error),
        };
      }
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  return { name, samples: durations.sort((a, b) => a - b), failed: false, lastStatus };
}

function evidence(rows, meta) {
  const measured = rows.filter((r) => !r.failed && r.samples.length > 0);
  const within = measured.every((r) => percentile(r.samples, 95) <= SLO3_P95_MS);
  const overall = measured.length > 0 && !rows.some((r) => r.failed) && within ? 'Pass' : 'Fail';
  return [
    `# M9-004 — SLO-3 p95 latency baseline (staging) — ${meta.checkedAt}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Sampled (UTC) | ${meta.checkedAt} |`,
    `| Env | staging (${meta.host}), light load |`,
    `| Method | Client-side RTT from operator machine; ${WARMUP} warmup + ${SAMPLES} sequential samples per endpoint; seed admin session (password + TOTP) |`,
    `| SLO-3 target | p95 ≤ ${SLO3_P95_MS} ms on core GETs (B-07) |`,
    `| Overall | **${overall}** |`,
    '',
    '| Endpoint | HTTP | n | p50 | p95 | max | Within SLO-3 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => {
      if (r.failed || r.samples.length === 0) {
        return `| ${r.name} | ${r.lastStatus} | 0 | — | — | — | n/a (sample failed) |`;
      }
      const p50 = percentile(r.samples, 50);
      const p95 = percentile(r.samples, 95);
      const max = r.samples[r.samples.length - 1];
      return `| ${r.name} | ${r.lastStatus} | ${r.samples.length} | ${p50} ms | ${p95} ms | ${max} ms | ${p95 <= SLO3_P95_MS ? 'yes' : 'NO'} |`;
    }),
    '',
    '## Honesty',
    '',
    '- Client-side RTT includes operator network path to Frankfurt; Fly-side p95 may be lower.',
    '- Sample is a baseline under light load, not sustained-load evidence.',
    '- This record intentionally contains no credential, token, email, tenant ID, or learner data.',
    '',
  ].join('\n');
}

async function main() {
  const base = stagingApiBase();
  const email = process.env['SEED_ADMIN_EMAIL']?.trim();
  const password = process.env['SEED_ADMIN_PASS']?.trim();
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASS required');
  const key = loadEncryptionKey();
  if (!key) throw new Error('MFA_TOTP_ENCRYPTION_KEY missing or malformed');

  const { tenantId, secretEncrypted } = await resolveAdminContext(email);
  const totpSecret = decryptTotpSecret(secretEncrypted, key);
  process.stdout.write('admin context resolved; TOTP decrypted in memory (not printed)\n');

  const token = await loginAndVerify(base, email, password, tenantId, totpSecret);
  process.stdout.write('authenticated session established (password + TOTP)\n');

  const authHeaders = { 'authorization': `Bearer ${token}`, 'x-tenant-id': tenantId };
  const endpoints = [
    { name: 'GET /health (control)', path: '/health', headers: undefined },
    { name: 'GET /api/v1/auth/me', path: '/api/v1/auth/me', headers: authHeaders },
    { name: 'GET /api/v1/tenants/current', path: '/api/v1/tenants/current', headers: authHeaders },
    { name: 'GET /api/v1/students', path: '/api/v1/students', headers: authHeaders },
    { name: 'GET /api/v1/academic-years', path: '/api/v1/academic-years', headers: authHeaders },
  ];

  const rows = [];
  for (const endpoint of endpoints) {
    const row = await sampleEndpoint(endpoint.name, `${base}${endpoint.path}`, endpoint.headers);
    rows.push(row);
    const p95 = row.samples.length > 0 ? percentile(row.samples, 95) : 'n/a';
    process.stdout.write(
      `${endpoint.name}: ${row.failed ? 'FAILED' : 'ok'} (http=${row.lastStatus}, n=${row.samples.length}, p95=${p95}ms)\n`,
    );
  }

  const checkedAt = new Date().toISOString();
  const content = evidence(rows, { checkedAt, host: new URL(base).host });
  const recordsDir = path.join(projectRoot, 'docs', 'engineering', 'task-records');
  mkdirSync(recordsDir, { recursive: true });
  const output = path.join(
    recordsDir,
    `M9-004-latency-baseline-staging-${checkedAt.replace(/[:.]/g, '-')}.md`,
  );
  writeFileSync(output, content, 'utf8');
  process.stdout.write(`wrote ${path.relative(projectRoot, output)}\n`);

  const failed = rows.some(
    (r) => r.failed || (r.samples.length > 0 && percentile(r.samples, 95) > SLO3_P95_MS),
  );
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
