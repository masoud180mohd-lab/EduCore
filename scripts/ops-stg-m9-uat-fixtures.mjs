/**
 * M9-002 UAT fixtures — staging (idempotent).
 *
 * Seeds the fixtures the M9 UAT checklist was blocked on:
 *  - C5: a parent LOGIN user bound to the existing guardian (bind_guardian_user
 *    also assigns the parent role).
 *  - D1/D2/D3: a teacher login user with the teacher role, an organization,
 *    and an open exam with one subject.
 *
 * Demo credentials are written to .local/ (gitignored) only — never printed
 * to stdout. All other output is ids/statuses.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-m9-uat-fixtures.mjs
 */
import { createDecipheriv, createHmac, randomBytes, randomUUID, scrypt } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const DEFAULT_API_BASE = 'https://educore-api-staging.fly.dev';
const APPROVED_HOSTS = new Set(['educore-api-staging.fly.dev']);
const TIMEOUT_MS = 15_000;
const PARENT_EMAIL = 'parent@educore.staging';
const TEACHER_EMAIL = 'teacher@educore.staging';
const LOCAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.local');

// --- password hashing — mirrors apps/api auth/password-hasher.ts ---
function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err !== null) return reject(err);
      resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return [
    'scrypt',
    '16384',
    '8',
    '1',
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

function demoPassword() {
  return `Uat-${randomBytes(9).toString('base64url')}-9!`;
}

/** Reads or creates a demo credential file in .local/ (gitignored). */
function credentialFor(label, email) {
  mkdirSync(LOCAL_DIR, { recursive: true });
  const file = path.join(LOCAL_DIR, `stg-uat-${label}.txt`);
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim();
    const match = /^password=(.+)$/m.exec(existing);
    if (match !== null) return { file, email, password: match[1], created: false };
  }
  const password = demoPassword();
  writeFileSync(file, `email=${email}\npassword=${password}\n`, 'utf8');
  try {
    chmodSync(file, 0o600);
  } catch {
    /* best effort on Windows */
  }
  return { file, email, password, created: true };
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

async function api(base, token, tenantId, method, pathName, body, idem) {
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idem !== undefined) headers['idempotency-key'] = idem;
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json = null;
  const text = await res.text();
  if (text !== '') {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, json };
}

async function main() {
  const rawBase = process.env['EDUCORE_STAGING_API'] ?? DEFAULT_API_BASE;
  const baseUrl = new URL(rawBase);
  if (baseUrl.protocol !== 'https:' || !APPROVED_HOSTS.has(baseUrl.hostname)) {
    throw new Error('EDUCORE_STAGING_API must use an approved staging Fly HTTPS host');
  }
  const base = baseUrl.origin;

  const adminEmail = process.env['SEED_ADMIN_EMAIL']?.trim();
  const adminPassword = process.env['SEED_ADMIN_PASS']?.trim();
  if (!adminEmail || !adminPassword) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASS required');
  const key = loadEncryptionKey();
  if (!key) throw new Error('MFA_TOTP_ENCRYPTION_KEY missing or malformed');

  const dbUrl = process.env['DATABASE_URL']?.trim();
  if (!dbUrl) throw new Error('DATABASE_URL required');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;

  try {
    // ---- context ----
    const tenant = (await q(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`))[0];
    if (tenant === undefined) throw new Error('no tenant found');
    const tenantId = tenant.id;
    const admin = (
      await q(`SELECT id FROM users WHERE lower(email) = lower($1)`, [adminEmail])
    )[0];
    if (admin === undefined) throw new Error('seed admin user not found');
    const adminUserId = admin.id;
    const factor = (
      await q(
        `SELECT secret_encrypted FROM mfa_factors
         WHERE user_id = $1 AND factor_type = 'totp' AND status = 'active' LIMIT 1`,
        [adminUserId],
      )
    )[0];
    if (factor === undefined) throw new Error('no active TOTP factor for seed admin');
    const totpSecret = decryptTotpSecret(factor.secret_encrypted, key);

    // ---- C5: parent user + guardian bind ----
    // Prefer the user already bound to the guardian (an earlier UAT may have
    // created it); only create a fresh parent user when nothing is bound.
    const guardian = (await q(`SELECT id, user_id FROM guardians LIMIT 1`))[0];
    if (guardian === undefined) throw new Error('no guardian fixture to bind (run earlier UAT seed)');
    let parentUser = null;
    let parentCred = null;
    if (guardian.user_id !== null) {
      parentUser = { id: guardian.user_id };
      const boundEmail = (
        await q(`SELECT email FROM users WHERE id = $1`, [guardian.user_id])
      )[0]?.email;
      if (boundEmail === undefined) throw new Error('bound parent user row missing');
      parentCred = credentialFor('parent', boundEmail);
      process.stdout.write(
        `guardian already bound to parent user (${guardian.user_id}); password file ${parentCred.created ? 'CREATED — you must reset this user password to match' : 'reused'}\n`,
      );
      if (parentCred.created) {
        const hash = await hashPassword(parentCred.password);
        await q(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, guardian.user_id]);
        process.stdout.write('bound parent user password reset to match credential file\n');
      }
    } else {
      const existing = (
        await q(`SELECT id FROM users WHERE lower(email) = lower($1)`, [PARENT_EMAIL])
      )[0];
      parentCred = credentialFor('parent', PARENT_EMAIL);
      if (existing === undefined) {
        const parentId = randomUUID();
        const hash = await hashPassword(parentCred.password);
        await q(
          `INSERT INTO users (id, email, email_verified_at, display_name, status, password_hash)
           VALUES ($1, $2, now(), 'UAT Parent', 'active', $3)`,
          [parentId, PARENT_EMAIL, hash],
        );
        await q(
          `INSERT INTO tenant_memberships (id, tenant_id, user_id, status, joined_at)
           VALUES ($1, $2, $3, 'active', now())
           ON CONFLICT (tenant_id, user_id) DO NOTHING`,
          [randomUUID(), tenantId, parentId],
        );
        parentUser = { id: parentId };
        process.stdout.write(`parent user created (${parentId})\n`);
      } else {
        parentUser = { id: existing.id };
        process.stdout.write(`parent user exists (${existing.id}); password file reused\n`);
      }
      await q(`SELECT * FROM app.bind_guardian_user($1, $2, $3, $4)`, [
        adminUserId,
        tenantId,
        guardian.id,
        parentUser.id,
      ]);
      process.stdout.write(`guardian ${guardian.id} bound to parent user (parent role assigned)\n`);
    }

    // ---- D1-D3: teacher user ----
    // Roles are created through the app API when missing (owner/admin may not
    // have created teacher/head_teacher for this tenant yet).
    const token = await loginAndVerify(base, adminEmail, adminPassword, tenantId, totpSecret);
    process.stdout.write('admin session established\n');

    let teacherRole = (
      await q(`SELECT id FROM roles WHERE tenant_id = $1 AND code = 'teacher'`, [tenantId])
    )[0];
    if (teacherRole === undefined) {
      const created = await api(
        base,
        token,
        tenantId,
        'POST',
        '/api/v1/roles',
        {
          code: 'teacher',
          name: 'Teacher',
          permissionCodes: [
            'tenant.read',
            'organization.read',
            'student.read',
            'academic.read',
            'attendance.read',
            'attendance.manage',
            'marks.read',
            'marks.manage',
          ],
        },
        randomUUID(),
      );
      if (created.status !== 201) {
        throw new Error(`teacher role create failed (http ${created.status}: ${created.json?.error?.code})`);
      }
      teacherRole = { id: created.json?.data?.id };
      process.stdout.write(`teacher role created (${teacherRole.id})\n`);
    }
    let teacherUser = (await q(`SELECT id FROM users WHERE lower(email) = lower($1)`, [TEACHER_EMAIL]))[0];
    const teacherCred = credentialFor('teacher', TEACHER_EMAIL);
    if (teacherUser === undefined) {
      const teacherId = randomUUID();
      const hash = await hashPassword(teacherCred.password);
      await q(
        `INSERT INTO users (id, email, email_verified_at, display_name, status, password_hash)
         VALUES ($1, $2, now(), 'UAT Teacher', 'active', $3)`,
        [teacherId, TEACHER_EMAIL, hash],
      );
      await q(
        `INSERT INTO tenant_memberships (id, tenant_id, user_id, status, joined_at)
         VALUES ($1, $2, $3, 'active', now())
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [randomUUID(), tenantId, teacherId],
      );
      teacherUser = { id: teacherId };
      process.stdout.write(`teacher user created (${teacherId})\n`);
    } else {
      process.stdout.write(`teacher user exists (${teacherUser.id}); password file reused\n`);
    }
    await q(
      `INSERT INTO user_roles (id, tenant_id, user_id, role_id, created_by_user_id)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM user_roles WHERE tenant_id = $2 AND user_id = $3 AND role_id = $4
       )`,
      [randomUUID(), tenantId, teacherUser.id, teacherRole.id, adminUserId],
    );

    // ---- academic ids ----
    const year = (await q(`SELECT id FROM academic_years WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`, [tenantId]))[0];
    const cls = (await q(`SELECT id FROM classes WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`, [tenantId]))[0];
    if (year === undefined || cls === undefined) throw new Error('academic year/class fixtures missing');

    const orgs = await api(base, token, tenantId, 'GET', '/api/v1/organizations?limit=5');
    if (orgs.status !== 200) throw new Error(`organizations list failed (http ${orgs.status})`);
    const orgList = Array.isArray(orgs.json?.data) ? orgs.json.data : [];
    if (orgList.length === 0) {
      const created = await api(
        base,
        token,
        tenantId,
        'POST',
        '/api/v1/organizations',
        { orgType: 'school', name: 'UAT Pilot Campus', code: 'uat-campus' },
        randomUUID(),
      );
      if (created.status !== 201) {
        throw new Error(`organization create failed (http ${created.status}: ${created.json?.error?.code})`);
      }
      process.stdout.write(`organization created (${created.json?.data?.id})\n`);
    } else {
      process.stdout.write(`organization exists (${orgList[0].id})\n`);
    }

    const exams = await api(base, token, tenantId, 'GET', '/api/v1/exams?limit=5');
    if (exams.status !== 200) throw new Error(`exams list failed (http ${exams.status})`);
    const examList = Array.isArray(exams.json?.data) ? exams.json.data : [];
    let examId = examList[0]?.id;
    if (examId === undefined) {
      const created = await api(
        base,
        token,
        tenantId,
        'POST',
        '/api/v1/exams',
        {
          name: 'UAT Mid-Term Assessment',
          academicYearId: year.id,
          classId: cls.id,
          status: 'open',
        },
        randomUUID(),
      );
      if (created.status !== 201) {
        throw new Error(`exam create failed (http ${created.status}: ${created.json?.error?.code})`);
      }
      examId = created.json?.data?.id;
      process.stdout.write(`exam created (${examId})\n`);
    } else {
      process.stdout.write(`exam exists (${examId})\n`);
    }

    const subjects = await api(base, token, tenantId, 'GET', '/api/v1/subjects?limit=5');
    const subjectList = Array.isArray(subjects.json?.data) ? subjects.json.data : [];
    if (subjectList.length === 0) throw new Error('no subjects seeded — cannot attach exam subject');
    const examSubjects = await api(base, token, tenantId, 'GET', `/api/v1/exams/${examId}/subjects`);
    const attached = Array.isArray(examSubjects.json?.data) ? examSubjects.json.data : [];
    if (attached.length === 0) {
      const added = await api(
        base,
        token,
        tenantId,
        'POST',
        `/api/v1/exams/${examId}/subjects`,
        { subjectId: subjectList[0].id, maxScore: 100 },
        randomUUID(),
      );
      if (added.status !== 201) {
        throw new Error(`exam subject attach failed (http ${added.status}: ${added.json?.error?.code})`);
      }
      process.stdout.write(`exam subject attached (${subjectList[0].id})\n`);
    } else {
      process.stdout.write('exam already has subjects\n');
    }

    // ---- smoke: parent login works (password only, no MFA expected) ----
    const parentLogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: PARENT_EMAIL, password: parentCred.password, tenantId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parentBody = await parentLogin.json().catch(() => null);
    const parentOk =
      parentLogin.status === 200 &&
      (parentBody?.data?.accessToken !== undefined || parentBody?.data?.requiresMfa === true);
    process.stdout.write(
      `parent login smoke: http ${parentLogin.status} ${parentOk ? 'ok' : `shape=${String(parentBody?.data?.requiresMfa)}`}\n`,
    );
    const teacherLogin = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: TEACHER_EMAIL, password: teacherCred.password, tenantId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const teacherBody = await teacherLogin.json().catch(() => null);
    const teacherOk =
      teacherLogin.status === 200 &&
      (teacherBody?.data?.accessToken !== undefined || teacherBody?.data?.requiresMfa === true);
    process.stdout.write(
      `teacher login smoke: http ${teacherLogin.status} ${teacherOk ? 'ok' : `shape=${String(teacherBody?.data?.requiresMfa)}`}\n`,
    );

    if (!parentOk || !teacherOk) process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
