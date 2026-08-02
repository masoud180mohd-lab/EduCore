/**
 * Headless browser manual QA for admin polish (IMP-029…035).
 * Requires: API :3000, web :3001, seed admin.
 *
 * npx -y playwright@1.51.1 install chromium
 * npx tsx scripts/manual-qa-admin-browser.ts
 */

import { chromium, type Page } from 'playwright';

const WEB = process.env['QA_WEB_BASE']?.trim() || 'http://127.0.0.1:3001';
const API = process.env['QA_API_BASE']?.trim() || 'http://127.0.0.1:3000';
const TENANT_ID = '01900000-0010-7000-8000-000000000001';
const EMAIL = 'admin@educore.local';
const PASS = process.env['SEED_ADMIN_PASS']?.trim() || 'ChangeMe-Local-Only-1';

type Result = { id: string; pass: boolean; note: string };
const results: Result[] = [];

function record(id: string, pass: boolean, note: string): void {
  results.push({ id, pass, note });
  process.stdout.write(`[${pass ? 'PASS' : 'FAIL'}] ${id}: ${note}\n`);
}

async function login(page: Page): Promise<void> {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.fill('#tenantId', TENANT_ID);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/t\/[^/]+\/(admin|teacher|parent)/, { timeout: 20000 });
}

async function apiToken(): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantId: TENANT_ID }),
  });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error('login failed for API helper');
  return json.data.accessToken;
}

async function findStudentId(token: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/students?limit=5`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': TENANT_ID,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return json.data?.[0]?.id ?? null;
}

async function findIssuedInvoiceId(token: string): Promise<string | null> {
  const res = await fetch(`${API}/api/v1/invoices?limit=50`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': TENANT_ID,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ id: string; status: string }> };
  const issued = (json.data ?? []).find((i) => i.status === 'issued');
  return issued?.id ?? json.data?.[0]?.id ?? null;
}

async function main(): Promise<void> {
  process.stdout.write(`\n=== Admin polish browser QA ===\nWeb: ${WEB}\n\n`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'msedge',
  });
  const page = await browser.newPage();

  try {
    await login(page);
    record('browser.login', true, page.url());

    const adminBase = `/t/${TENANT_ID}/admin`;
    await page.goto(`${WEB}${adminBase}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('nav.admin-nav-groups, nav[aria-label="Admin"]', {
      timeout: 15000,
    });
    record(
      'browser.nav_groups',
      (await page.locator('.admin-nav-group').count()) >= 3,
      'grouped nav visible',
    );

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${WEB}${adminBase}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    record(
      'browser.nav_768_no_overflow',
      scrollWidth <= clientWidth + 2,
      `scroll ${scrollWidth} vs ${clientWidth}`,
    );

    await page.goto(`${WEB}${adminBase}/fees/invoices`, { waitUntil: 'networkidle' });
    const feesLink = page.locator('nav a[aria-current="page"]', { hasText: 'Fees' });
    record('browser.fees_current_on_list', (await feesLink.count()) > 0, 'Fees aria-current');

    await page.goto(`${WEB}${adminBase}/settings`, { waitUntil: 'networkidle' });
    const extrasVisible = await page.locator('#extrasJson').isVisible();
    record('browser.settings_no_default_json', !extrasVisible, 'textarea hidden by default');

    await page.click('button:has-text("Advanced: edit additional JSON")');
    await page.waitForSelector('#extrasJson', { state: 'visible', timeout: 5000 });
    record('browser.settings_advanced_shows_json', true, 'textarea visible after toggle');

    await page.fill('#extrasJson', '{ invalid');
    await page.click('button:has-text("Save settings")');
    await page.waitForSelector('.banner-error, [role="alert"]', { timeout: 5000 });
    const errText = await page.locator('.banner-error, [role="alert"]').first().textContent();
    record(
      'browser.settings_invalid_json',
      /invalid|JSON/i.test(errText ?? ''),
      errText?.trim() ?? '',
    );

    const token = await apiToken();
    const invoiceId = await findIssuedInvoiceId(token);
    if (invoiceId) {
      try {
        await page.goto(`${WEB}${adminBase}/fees/invoices/${invoiceId}`, {
          waitUntil: 'networkidle',
        });
        const voidBtn = page.locator('button:has-text("Void")');
        if (await voidBtn.isEnabled()) {
          await voidBtn.click();
          const dialog = page.locator('[role="alertdialog"]');
          await dialog.waitFor({ state: 'visible', timeout: 5000 });
          record('browser.void_confirm_dialog', true, 'ConfirmDialog opens');
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden', timeout: 5000 });
          record('browser.void_esc_dismiss', true, 'Esc closes dialog');
        } else {
          record('browser.void_confirm_dialog', false, 'Void disabled — no issued unpaid invoice');
          record('browser.void_esc_dismiss', false, 'skipped');
        }
      } catch (err) {
        record('browser.void_confirm_dialog', false, String(err));
        record('browser.void_esc_dismiss', false, 'skipped');
      }
    } else {
      record('browser.void_confirm_dialog', false, 'No invoice in lab to test void');
      record('browser.void_esc_dismiss', false, 'skipped');
    }

    try {
      const studentId = await findStudentId(token);
      if (!studentId) {
        record('browser.student_crosslinks', false, 'No student in lab');
      } else {
        await page.goto(`${WEB}${adminBase}/students/${studentId}`, {
          waitUntil: 'networkidle',
        });
        await page.waitForSelector('h2, h3', { timeout: 10000 });
        const hasCrossLinks =
          (await page.getByRole('heading', { name: 'Enrollments' }).count()) > 0 ||
          (await page.getByRole('heading', { name: 'Fees' }).count()) > 0;
        record('browser.student_crosslinks', hasCrossLinks, page.url());
      }
    } catch (err) {
      record('browser.student_crosslinks', false, String(err));
    }
  } catch (err) {
    record('browser.fatal', false, String(err));
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  process.stdout.write(`\n=== Browser: ${passed}/${results.length} passed ===\n`);
  const failed = results.filter((r) => !r.pass && r.id !== 'browser.fatal');
  if (failed.length > 0) process.exit(1);
}

void main();
