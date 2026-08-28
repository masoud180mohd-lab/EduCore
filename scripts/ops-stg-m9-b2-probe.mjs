/**
 * M9-002 B2 diagnosis — staging probe (read-only).
 *
 * Replicates what the admin enrollment-detail page does: resolves FK ids
 * (academic year, class, stream, organization) through their GET-by-id
 * endpoints and reports which resolution fails. A failure here is exactly
 * what makes the UI fall back to showing raw UUIDs.
 *
 * Prints no secret values, tokens, emails, or learner data. Only resource
 * ids (UUIDs) and HTTP statuses, which are safe evidence.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-m9-b2-probe.mjs
 */
import { createDecipheriv, createHmac } from 'node:crypto';

import pg from 'pg';

const DEFAULT_API_BASE = 'https://educore-api-staging.fly.dev';
const APPROVED_HOSTS = new Set(['educore-api-staging.fly.dev']);
const TIMEOUT_MS = 15_000;

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

async function loginAndVerify(base, email, password, tenantId, totpSecret) {
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
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
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ mfaChallengeToken: data.mfaChallengeToken, code: totpCode(totpSecret) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (verify.status !== 200) throw new Error(`mfa verify failed (http ${verify.status})`);
  const token = (await verify.json())?.data?.accessToken;
  if (!token) throw new Error('mfa verify returned no access token');
  return token;
}

async function getJson(base, path, headers) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json', ...(headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body = null;
    const text = await res.text();
    if (text !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return { status: res.status, body };
  } catch {
    return { status: 'error', body: null };
  }
}

function shape(body) {
  // Safe shape summary only — never print values other than structural keys.
  if (body === null) return 'no-body';
  if (body?.error?.code !== undefined) return `error=${String(body.error.code)}`;
  if (body?.data === undefined) return 'no-data-key';
  const d = body.data;
  if (Array.isArray(d)) return `array(${d.length})`;
  if (typeof d === 'object' && d !== null) {
    const keys = Object.keys(d).slice(0, 12);
    return `obj{${keys.join(',')}}`;
  }
  return typeof d;
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
  const token = await loginAndVerify(base, email, password, tenantId, totpSecret);
  const headers = { authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
  process.stdout.write('authenticated session established\n\n');

  // 1. Enrollments list — collect FK ids.
  const list = await getJson(base, '/api/v1/enrollments?limit=5', headers);
  process.stdout.write(`GET /api/v1/enrollments -> ${list.status} ${shape(list.body)}\n`);
  const rows = Array.isArray(list.body?.data) ? list.body.data : [];

  const seen = { year: new Set(), cls: new Set(), stream: new Set() };
  for (const row of rows) {
    if (row.academicYearId) seen.year.add(row.academicYearId);
    if (row.classId) seen.cls.add(row.classId);
    if (row.streamId) seen.stream.add(row.streamId);
  }

  for (const [kind, pathBase] of [
    ['academic-year', '/api/v1/academic-years'],
    ['class', '/api/v1/classes'],
    ['stream', '/api/v1/streams'],
  ]) {
    const ids = [...seen[kind === 'academic-year' ? 'year' : kind === 'class' ? 'cls' : 'stream']];
    if (ids.length === 0) {
      process.stdout.write(`${kind}: no ids to probe\n`);
      continue;
    }
    for (const id of ids) {
      const one = await getJson(base, `${pathBase}/${id}`, headers);
      process.stdout.write(
        `${kind} ${id}: GET -> ${one.status} ${shape(one.body)}\n`,
      );
    }
  }

  // 2. Organizations list + first by-id (B2 mentioned org UUIDs).
  const orgs = await getJson(base, '/api/v1/organizations?limit=5', headers);
  process.stdout.write(`\nGET /api/v1/organizations -> ${orgs.status} ${shape(orgs.body)}\n`);
  const orgRows = Array.isArray(orgs.body?.data) ? orgs.body.data : [];
  for (const org of orgRows) {
    if (!org.id) continue;
    const one = await getJson(base, `/api/v1/organizations/${org.id}`, headers);
    process.stdout.write(`organization ${org.id}: GET -> ${one.status} ${shape(one.body)}\n`);
    if (org.parentOrganizationId) {
      const parent = await getJson(
        base,
        `/api/v1/organizations/${org.parentOrganizationId}`,
        headers,
      );
      process.stdout.write(
        `  parentOrganization ${org.parentOrganizationId}: GET -> ${parent.status} ${shape(parent.body)}\n`,
      );
    }
  }

  // 3. Academic years list (picker source) for completeness.
  const years = await getJson(base, '/api/v1/academic-years?limit=5', headers);
  process.stdout.write(`\nGET /api/v1/academic-years -> ${years.status} ${shape(years.body)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
