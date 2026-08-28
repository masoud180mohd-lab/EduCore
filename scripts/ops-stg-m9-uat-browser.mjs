/**
 * M9-002 browser UAT re-run — drives the deployed staging web app in a real
 * browser (Playwright, Edge channel) and records pass/fail per UAT row.
 *
 * Rows covered:
 *   A1   admin login + TOTP MFA challenge (browser)
 *   B1   admin students list renders
 *   B2   enrollment detail shows resolved names, not raw UUIDs
 *   C1   fee structures page loads
 *   C2   create draft invoice via Fees UI (for the guardian-linked student)
 *   E1   mobile money honesty banner (provider not configured)
 *   C3   record office cash payment via invoice detail
 *   C4   receipt page opens from payment row
 *   C5   parent portal: login, linked student, invoices visible
 *   D1   teacher shell loads
 *   D2   open attendance session, mark present, save, persists on reload
 *   D3   open exam subject marks, enter score, save, persists on reload
 *
 * Evidence: screenshots + results.json under .local/m9-uat-browser/ (gitignored).
 * Secrets (passwords, tokens, TOTP codes) are never printed.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-m9-uat-browser.mjs
 */
import { createDecipheriv, createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_BASE = 'https://educore-web-staging.fly.dev';
const API_BASE = 'https://educore-api-staging.fly.dev';
const EVIDENCE_DIR = path.join(ROOT, '.local', 'm9-uat-browser');
const STEP_TIMEOUT_MS = 30_000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// --- results bookkeeping -----------------------------------------------------
const results = [];
let stepIndex = 0;

function record(row, name, pass, detail) {
  results.push({ row, name, pass, detail });
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'}  [${row}] ${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function shot(page, label) {
  stepIndex += 1;
  const file = path.join(EVIDENCE_DIR, `${String(stepIndex).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return path.basename(file);
}

// --- TOTP scaffolding (mirrors apps/api auth/totp.ts) ------------------------
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
    return { tenantId, secretEncrypted: factorQ.rows[0].secret_encrypted };
  } finally {
    await client.end().catch(() => undefined);
  }
}

// --- API pre-fetch (read-only context for targeting) -------------------------
async function apiLoginMfa(email, password, tenantId, totpSecret) {
  const login = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (login.status !== 200) throw new Error(`admin login failed (http ${login.status})`);
  const data = (await login.json())?.data ?? {};
  if (!data.requiresMfa || !data.mfaChallengeToken) {
    if (data.accessToken) return data.accessToken;
    throw new Error('unexpected admin login shape');
  }
  const verify = await fetch(`${API_BASE}/api/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ mfaChallengeToken: data.mfaChallengeToken, code: totpCode(totpSecret) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (verify.status !== 200) throw new Error(`admin mfa verify failed (http ${verify.status})`);
  const token = (await verify.json())?.data?.accessToken;
  if (!token) throw new Error('admin mfa verify returned no access token');
  return token;
}

async function apiLoginPlain(email, password, tenantId) {
  const login = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (login.status !== 200) throw new Error(`login failed (http ${login.status})`);
  const token = (await login.json())?.data?.accessToken;
  if (!token) throw new Error('login returned no access token');
  return token;
}

async function apiGet(token, tenantId, apiPath) {
  const res = await fetch(`${API_BASE}${apiPath}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 200) throw new Error(`GET ${apiPath} -> http ${res.status}`);
  return (await res.json())?.data;
}

function readCredentials(label) {
  const file = path.join(ROOT, '.local', `stg-uat-${label}.txt`);
  const raw = readFileSync(file, 'utf8');
  const email = /^email=(.+)$/m.exec(raw)?.[1];
  const password = /^password=(.+)$/m.exec(raw)?.[1];
  if (!email || !password) throw new Error(`credential file for ${label} malformed`);
  return { email, password };
}

// --- browser helpers ----------------------------------------------------------
async function uiLogin(page, tenantId, email, password, expectUrlGlob) {
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#tenantId', tenantId);
  await page.locator('form:has(#email) button[type="submit"]').click();
  await page.waitForURL(expectUrlGlob, { timeout: STEP_TIMEOUT_MS });
}

async function selectFirstOption(page, selector, preferredValue = null) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el !== null && el.querySelectorAll('option').length > 1;
    },
    selector,
    { timeout: STEP_TIMEOUT_MS },
  );
  const options = await page.locator(`${selector} option`).evaluateAll((opts) =>
    opts.map((o) => o.value),
  );
  const nonEmpty = options.filter((v) => v !== '');
  if (nonEmpty.length === 0) throw new Error(`${selector} has no selectable options`);
  const value =
    preferredValue !== null && nonEmpty.includes(preferredValue) ? preferredValue : nonEmpty[0];
  await page.selectOption(selector, value);
  return value;
}

// --- main ---------------------------------------------------------------------
async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const adminEmail = process.env['SEED_ADMIN_EMAIL']?.trim();
  const adminPass = process.env['SEED_ADMIN_PASS']?.trim();
  if (!adminEmail || !adminPass) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASS required');
  const key = loadEncryptionKey();
  if (!key) throw new Error('MFA_TOTP_ENCRYPTION_KEY missing or malformed');

  const { tenantId, secretEncrypted } = await resolveAdminContext(adminEmail);
  const totpSecret = decryptTotpSecret(secretEncrypted, key);
  const adminToken = await apiLoginMfa(adminEmail, adminPass, tenantId, totpSecret);
  process.stdout.write('admin api session established\n');

  // Targeting: guardian-linked student (C2/C5) and enrolled class (D2).
  const parentCred = readCredentials('parent');
  const teacherCred = readCredentials('teacher');
  const parentToken = await apiLoginPlain(parentCred.email, parentCred.password, tenantId);
  const links = await apiGet(parentToken, tenantId, '/api/v1/me/guardian/links');
  const linkedStudentId = Array.isArray(links) && links.length > 0 ? links[0].studentId : null;
  const enrollments = await apiGet(adminToken, tenantId, '/api/v1/enrollments?limit=5');
  const enrolledClassId =
    Array.isArray(enrollments) && enrollments.length > 0 ? enrollments[0].classId : null;
  process.stdout.write(
    `targets resolved: linkedStudent=${linkedStudentId !== null} enrolledClass=${enrolledClassId !== null}\n\n`,
  );

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ===== Phase 1: admin (A / B / C / E rows) ==================================
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // A1 — login + MFA challenge in the browser.
    try {
      await page.goto(`${WEB_BASE}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await page.fill('#email', adminEmail);
      await page.fill('#password', adminPass);
      await page.fill('#tenantId', tenantId);
      await page.locator('form:has(#email) button[type="submit"]').click();
      await page.waitForSelector('#mfaCode', { timeout: STEP_TIMEOUT_MS });
      await page.fill('#mfaCode', totpCode(totpSecret));
      await page.locator('form:has(#mfaCode) button[type="submit"]').click();
      await page.waitForURL(`**/t/${tenantId}/**`, { timeout: STEP_TIMEOUT_MS });
      await shot(page, 'a1-admin-home');
      record('A1', 'admin login + TOTP MFA in browser', true, `landed: ${page.url()}`);
    } catch (error) {
      await shot(page, 'a1-admin-login-fail');
      record('A1', 'admin login + TOTP MFA in browser', false, String(error.message ?? error));
    }

    // B1 — students list renders rows.
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/admin/students`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForSelector('table tbody tr', { timeout: STEP_TIMEOUT_MS });
      const rowCount = await page.locator('table tbody tr').count();
      await shot(page, 'b1-students-list');
      record('B1', 'admin students list renders', rowCount > 0, `${rowCount} rows`);
    } catch (error) {
      await shot(page, 'b1-students-fail');
      record('B1', 'admin students list renders', false, String(error.message ?? error));
    }

    // B2 — enrollment detail resolves names (no raw UUIDs in body text).
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/admin/academic/enrollments`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      const detailLink = page
        .locator('a[href*="/admin/academic/enrollments/"]')
        .filter({ hasText: /./ })
        .first();
      await detailLink.waitFor({ timeout: STEP_TIMEOUT_MS });
      await detailLink.click();
      await page.waitForURL('**/admin/academic/enrollments/*', { timeout: STEP_TIMEOUT_MS });
      // Give the client-side name resolution GETs time to settle.
      await page.waitForTimeout(4_000);
      const bodyText = await page.evaluate(() => document.body.innerText);
      const uuids = bodyText.match(UUID_RE) ?? [];
      const file = await shot(page, 'b2-enrollment-detail');
      record(
        'B2',
        'enrollment detail shows names, not UUIDs',
        uuids.length === 0,
        uuids.length === 0 ? 'no UUIDs in body' : `uuids visible: ${[...new Set(uuids)].join(', ')}`,
      );
      void file;
    } catch (error) {
      await shot(page, 'b2-enrollment-fail');
      record('B2', 'enrollment detail shows names, not UUIDs', false, String(error.message ?? error));
    }

    // C1 — fee structures page loads with its create form.
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/admin/fees/structures`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await page.waitForSelector('form', { timeout: STEP_TIMEOUT_MS });
      const errorBanner = await page.locator('[role="alert"]').count();
      await shot(page, 'c1-fee-structures');
      record('C1', 'fee structures page loads', errorBanner === 0, errorBanner === 0 ? 'no alert banner' : 'alert banner present');
    } catch (error) {
      await shot(page, 'c1-fee-structures-fail');
      record('C1', 'fee structures page loads', false, String(error.message ?? error));
    }

    // C2 — create draft invoice through the Fees UI (guardian-linked student).
    let invoiceUrl = null;
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/admin/fees/invoices`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      const chosenStudent = await selectFirstOption(page, '#inv-student', linkedStudentId);
      await selectFirstOption(page, '#inv-year');
      await page.fill('#inv-line-desc', 'UAT browser re-run (M9-002)');
      await page.fill('#inv-line-amt', '50000');
      await page.locator('form:has(#inv-student) button[type="submit"]').click();
      await page.waitForURL('**/admin/fees/invoices/*', { timeout: STEP_TIMEOUT_MS });
      invoiceUrl = page.url();
      await shot(page, 'c2-invoice-created');
      record(
        'C2',
        'create draft invoice via Fees UI',
        true,
        `linked student used: ${chosenStudent === linkedStudentId}`,
      );
    } catch (error) {
      await shot(page, 'c2-invoice-fail');
      record('C2', 'create draft invoice via Fees UI', false, String(error.message ?? error));
    }

    // C3a — issue the draft invoice (payment forms appear only once issued).
    let issued = false;
    if (invoiceUrl !== null) {
      try {
        await page.locator('.actions button.btn-primary').first().click(); // Issue
        await page.waitForSelector('text=Invoice issued', { timeout: STEP_TIMEOUT_MS });
        issued = true;
      } catch (error) {
        await shot(page, 'c3-issue-fail');
        record('C3', 'issue invoice + record cash payment', false, `issue: ${String(error.message ?? error)}`);
      }
    } else {
      record('C3', 'issue invoice + record cash payment', false, 'skipped: no invoice created');
    }

    // E1 — mobile money honesty banner (provider not configured on staging).
    if (issued) {
      try {
        await page.fill('#momo-amount', '10000');
        await page.locator('form:has(#momo-amount) button[type="submit"]').click();
        await page.waitForSelector('text=Mobile money waits until a ClickPesa account exists', {
          timeout: STEP_TIMEOUT_MS,
        });
        await shot(page, 'e1-momo-honesty');
        record('E1', 'mobile money honesty banner shown', true);
      } catch (error) {
        await shot(page, 'e1-momo-fail');
        record('E1', 'mobile money honesty banner shown', false, String(error.message ?? error));
      }
    } else {
      record('E1', 'mobile money honesty banner shown', false, 'skipped: invoice not issued');
    }

    // C3b — record a full office cash payment.
    if (issued) {
      try {
        await page.selectOption('#pay-method', 'cash');
        await page.fill('#pay-amount', '50000');
        await page.locator('form:has(#pay-amount) button[type="submit"]').click();
        await page.waitForSelector('text=Payment recorded', { timeout: STEP_TIMEOUT_MS });
        const receiptLink = page.locator('a[href*="/admin/fees/receipts/"]').first();
        await receiptLink.waitFor({ timeout: STEP_TIMEOUT_MS });
        await shot(page, 'c3-payment-recorded');
        record('C3', 'issue invoice + record cash payment', true, 'receipt link present');
      } catch (error) {
        await shot(page, 'c3-payment-fail');
        record('C3', 'issue invoice + record cash payment', false, String(error.message ?? error));
      }
    } else if (invoiceUrl !== null) {
      // C3 already recorded as failed in C3a.
    }

    // C4 — receipt page opens from the payment row.
    if (invoiceUrl !== null) {
      try {
        await page.locator('a[href*="/admin/fees/receipts/"]').first().click();
        await page.waitForURL('**/admin/fees/receipts/*', { timeout: STEP_TIMEOUT_MS });
        await page.waitForTimeout(2_000);
        const bodyText = await page.evaluate(() => document.body.innerText);
        await shot(page, 'c4-receipt');
        record('C4', 'receipt page opens', bodyText.length > 0, page.url());
      } catch (error) {
        await shot(page, 'c4-receipt-fail');
        record('C4', 'receipt page opens', false, String(error.message ?? error));
      }
    } else {
      record('C4', 'receipt page opens', false, 'skipped: no invoice created');
    }

    await context.close();
  }

  // ===== Phase 2: parent (C5) ==================================================
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await uiLogin(page, tenantId, parentCred.email, parentCred.password, `**/t/${tenantId}/parent`);
      await shot(page, 'c5-parent-home');
      const studentLink = page.locator('a[href*="/parent/fees/students/"]').first();
      await studentLink.waitFor({ timeout: STEP_TIMEOUT_MS });
      await studentLink.click();
      await page.waitForURL('**/parent/fees/students/*', { timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(3_000);
      const invoiceCards = await page.locator('a[href*="/parent/fees/invoices/"]').count();
      await shot(page, 'c5-parent-invoices');
      record(
        'C5',
        'parent portal sees linked student invoices',
        invoiceCards > 0,
        `${invoiceCards} invoice(s) listed`,
      );
    } catch (error) {
      await shot(page, 'c5-parent-fail');
      record('C5', 'parent portal sees linked student invoices', false, String(error.message ?? error));
    }
    await context.close();
  }

  // ===== Phase 3: teacher (D rows) =============================================
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // D1 — teacher shell loads after login.
    try {
      await uiLogin(page, tenantId, teacherCred.email, teacherCred.password, `**/t/${tenantId}/teacher`);
      await shot(page, 'd1-teacher-home');
      record('D1', 'teacher login + shell loads', true, `landed: ${page.url()}`);
    } catch (error) {
      await shot(page, 'd1-teacher-fail');
      record('D1', 'teacher login + shell loads', false, String(error.message ?? error));
    }

    // D2 — open attendance session, mark present, save, verify persistence.
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/teacher/attendance`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await selectFirstOption(page, '#classId', enrolledClassId);
      await page.locator('form:has(#classId) button[type="submit"]').click();
      await page.waitForURL('**/teacher/attendance/sessions/*', { timeout: STEP_TIMEOUT_MS });
      const firstGroup = page.locator('[role="radiogroup"]').first();
      await firstGroup.waitFor({ timeout: STEP_TIMEOUT_MS });
      await firstGroup.locator('label', { hasText: 'present' }).first().click();
      await page.getByRole('button', { name: /save|hifadhi/i }).first().click();
      await page.waitForTimeout(3_000);
      await shot(page, 'd2-attendance-saved');
      // Persistence check: reload and confirm the present radio stays checked.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[role="radiogroup"]').first().waitFor({ timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(2_000);
      const checked = await page
        .locator('[role="radiogroup"]')
        .first()
        .locator('input[type="radio"][value="present"]')
        .isChecked();
      await shot(page, 'd2-attendance-reload');
      record('D2', 'attendance session mark + persist', checked, checked ? 'present persisted on reload' : 'not persisted');
    } catch (error) {
      await shot(page, 'd2-attendance-fail');
      record('D2', 'attendance session mark + persist', false, String(error.message ?? error));
    }

    // D3 — enter marks for the seeded exam subject, save, verify persistence.
    try {
      await page.goto(`${WEB_BASE}/t/${tenantId}/teacher/marks`, {
        waitUntil: 'domcontentloaded',
        timeout: STEP_TIMEOUT_MS,
      });
      await page.locator('a[href*="/teacher/marks/exams/"]').first().waitFor({ timeout: STEP_TIMEOUT_MS });
      await page.locator('a[href*="/teacher/marks/exams/"]').first().click();
      await page.waitForURL('**/teacher/marks/exams/*', { timeout: STEP_TIMEOUT_MS });
      await page.locator('a[href*="/teacher/marks/subjects/"]').first().waitFor({ timeout: STEP_TIMEOUT_MS });
      await page.locator('a[href*="/teacher/marks/subjects/"]').first().click();
      await page.waitForURL('**/teacher/marks/subjects/*', { timeout: STEP_TIMEOUT_MS });
      const scoreInput = page.locator('input[placeholder="Alama"]').first();
      await scoreInput.waitFor({ timeout: STEP_TIMEOUT_MS });
      await scoreInput.fill('75');
      await page.getByRole('button', { name: /save|hifadhi/i }).first().click();
      await page.waitForTimeout(3_000);
      await shot(page, 'd3-marks-saved');
      // Persistence check: reload and confirm the score stays.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reloaded = page.locator('input[placeholder="Alama"]').first();
      await reloaded.waitFor({ timeout: STEP_TIMEOUT_MS });
      await page.waitForTimeout(2_000);
      const value = await reloaded.inputValue();
      await shot(page, 'd3-marks-reload');
      record('D3', 'exam marks entry + persist', value === '75', `score after reload: "${value}"`);
    } catch (error) {
      await shot(page, 'd3-marks-fail');
      record('D3', 'exam marks entry + persist', false, String(error.message ?? error));
    }

    await context.close();
  }

  await browser.close();

  // --- summary --------------------------------------------------------------
  const failures = results.filter((r) => !r.pass);
  writeFileSync(
    path.join(EVIDENCE_DIR, 'results.json'),
    `${JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        webBase: WEB_BASE,
        tenantId,
        results,
        failed: failures.length,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.stdout.write(
    `\nsummary: ${results.length - failures.length}/${results.length} passed; evidence in ${EVIDENCE_DIR}\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
