import { chromium } from 'playwright';

const WEB = 'http://127.0.0.1:3001';
const API = 'http://127.0.0.1:3000';
const TENANT = '01900000-0010-7000-8000-000000000001';
const EMAIL = 'admin@educore.local';
const PASS = process.env['SEED_ADMIN_PASS'] || 'ChangeMe-Local-Only-1';
const STUDENT = '01900000-0010-7000-8000-000000000023';

const results: Array<{ ok: boolean; id: string; note: string }> = [];

function rec(ok: boolean, id: string, note: string): void {
  results.push({ ok, id, note });
  process.stdout.write(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${note}\n`);
}

async function main(): Promise<void> {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantId: TENANT }),
  });
  const loginJson = (await login.json()) as { data?: { accessToken?: string } };
  rec(!!loginJson.data?.accessToken, 'api.login', String(login.status));

  const browser = await chromium.launch({
    headless: true,
    channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'msedge',
  });
  const page = await browser.newPage();
  try {
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.fill('#tenantId', TENANT);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/t\/[^/]+\/(admin|teacher|parent)/, { timeout: 20000 });
    rec(true, 'browser.login', page.url());

    await page.goto(`${WEB}/t/${TENANT}/admin/students/${STUDENT}`, {
      waitUntil: 'networkidle',
    });
    const enrollHref = await page
      .locator('a', { hasText: 'Create enrollment' })
      .getAttribute('href');
    const invoiceHref = await page.locator('a', { hasText: 'Create invoice' }).getAttribute('href');
    rec(
      !!enrollHref && enrollHref.includes(`studentId=${STUDENT}`),
      'student.enroll_href',
      enrollHref ?? 'missing',
    );
    rec(
      !!invoiceHref && invoiceHref.includes(`studentId=${STUDENT}`),
      'student.invoice_href',
      invoiceHref ?? 'missing',
    );

    await page.goto(`${WEB}/t/${TENANT}/admin/academic/enrollments?studentId=${STUDENT}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#enroll-student', { timeout: 15000 });
    await page.waitForTimeout(800);
    const enrollVal = await page.inputValue('#enroll-student');
    const enrollLabel = await page.locator('#enroll-student option:checked').textContent();
    rec(
      enrollVal === STUDENT,
      'prefill.enrollment_select',
      `value=${enrollVal} label=${(enrollLabel ?? '').trim()}`,
    );

    await page.goto(`${WEB}/t/${TENANT}/admin/fees/invoices?studentId=${STUDENT}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#inv-student', { timeout: 15000 });
    await page.waitForTimeout(800);
    const invVal = await page.inputValue('#inv-student');
    const invLabel = await page.locator('#inv-student option:checked').textContent();
    rec(
      invVal === STUDENT,
      'prefill.invoice_select',
      `value=${invVal} label=${(invLabel ?? '').trim()}`,
    );
  } catch (err) {
    rec(false, 'browser.fatal', String(err));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(
    `\n=== Prefill smoke: ${results.length - failed.length}/${results.length} passed ===\n`,
  );
  if (failed.length > 0) process.exit(1);
}

void main();
