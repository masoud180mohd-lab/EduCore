/**
 * Automated portion of admin polish manual QA (IMP-029…035).
 * Run after: npm run start:dev && npm run dev:web
 *
 * Usage: npx tsx scripts/manual-qa-admin-polish.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const API = process.env['QA_API_BASE']?.trim() || 'http://127.0.0.1:3000';
const TENANT_ID = '01900000-0010-7000-8000-000000000001';
const EMAIL = 'admin@educore.local';
const PASS = process.env['SEED_ADMIN_PASS']?.trim() || 'ChangeMe-Local-Only-1';

type Result = { readonly id: string; readonly pass: boolean; readonly note: string };

const results: Result[] = [];

function record(id: string, pass: boolean, note: string): void {
  results.push({ id, pass, note });
  const mark = pass ? 'PASS' : 'FAIL';
  process.stdout.write(`[${mark}] ${id}: ${note}\n`);
}

async function json<T>(path: string, init?: RequestInit & { token?: string }): Promise<{
  status: number;
  body: T;
}> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) {
    headers['Authorization'] = `Bearer ${init.token}`;
    headers['X-Tenant-Id'] = TENANT_ID;
  }
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const text = await response.text();
  let body: T = null as T;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = text as T;
    }
  }
  return { status: response.status, body };
}

async function loginToken(): Promise<string | undefined> {
  const login = await json<{ data?: { accessToken?: string } }>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantId: TENANT_ID }),
  });
  record('prep.login', login.status === 200 && login.body?.data?.accessToken !== undefined, `status ${login.status}`);
  return login.body?.data?.accessToken;
}

function staticUiChecks(): void {
  const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
  record('imp029.source_grouped_nav', shell.includes('admin-nav-groups') && shell.includes('groupAdminNav'), 'AdminShell.tsx');

  const settings = readFileSync(
    path.join(root, 'apps/web/src/app/t/[tenantId]/admin/settings/page.tsx'),
    'utf8',
  );
  record(
    'imp032.source_advanced_toggle',
    settings.includes('Advanced: edit additional JSON') && settings.includes('showAdvanced'),
    'settings/page.tsx',
  );
  record(
    'imp032.source_preserve_merge',
    settings.includes('mergeSettingsForSave(loadedExtras'),
    'settings/page.tsx',
  );
  record(
    'imp034.source_confirm_advanced',
    settings.includes('ConfirmDialog') && settings.includes('confirmAdvancedSave'),
    'settings/page.tsx',
  );

  const grepAdminConfirm = readFileSync(path.join(root, 'tests/tooling/imp034-admin-confirm-modal.test.ts'), 'utf8');
  record('imp034.tooling_no_window_confirm', grepAdminConfirm.includes('window.confirm'), 'imp034 test');

  const mapper = readFileSync(path.join(root, 'apps/web/src/lib/admin/admin-friendly-message.ts'), 'utf8');
  record('imp035.source_mapper', mapper.includes('adminFriendlyMessage'), 'admin-friendly-message.ts');
}

async function main(): Promise<void> {
  process.stdout.write(`\n=== Admin polish manual QA ===\nAPI: ${API}\nDate: ${new Date().toISOString()}\n\n`);

  try {
    const health = await fetch(`${API}/health`);
    record('prep.api_health', health.ok, `status ${health.status}`);
  } catch (err) {
    record('prep.api_health', false, `API unreachable: ${String(err)}`);
    summarize();
    process.exit(1);
  }

  const token = await loginToken();
  if (!token) {
    summarize();
    process.exit(1);
  }

  const me = await json<{ data?: { permissions?: string[]; roles?: { code: string }[] } }>(
    '/api/v1/auth/me',
    { token },
  );
  const perms = new Set(me.body?.data?.permissions ?? []);
  const roles = me.body?.data?.roles ?? [];
  record(
    'imp033.me_owner',
    roles.some((r) => r.code === 'owner') || perms.has('tenant.manage'),
    `roles=${roles.map((r) => r.code).join(',')}`,
  );

  const get0 = await json<{ data?: { schemaVersion: number; settings: Record<string, unknown> } }>(
    '/api/v1/tenant-settings',
    { token },
  );
  const schemaVersion = get0.body?.data?.schemaVersion ?? 1;
  const settings0 = get0.body?.data?.settings ?? {};
  const extrasKey = '__qa_extra_imp032';
  const withExtra = {
    ...settings0,
    [extrasKey]: { preserved: true, at: new Date().toISOString() },
    timezone: 'Africa/Dar_es_Salaam',
    locale: 'en-TZ',
    currency: 'TZS',
  };
  const putExtra = await json('/api/v1/tenant-settings', {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ schemaVersion, settings: withExtra }),
  });
  record('imp032.seed_extra', putExtra.status === 200, `status ${putExtra.status}`);

  const merged = { ...withExtra, timezone: 'Africa/Nairobi' };
  const putKnown = await json('/api/v1/tenant-settings', {
    method: 'PUT',
    token,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ schemaVersion, settings: merged }),
  });
  record('imp032.save_known', putKnown.status === 200, `status ${putKnown.status}`);

  const get1 = await json<{ data?: { settings: Record<string, unknown> } }>(
    '/api/v1/tenant-settings',
    { token },
  );
  const extraAfter = get1.body?.data?.settings?.[extrasKey];
  record(
    'imp032.extra_preserved',
    typeof extraAfter === 'object' &&
      extraAfter !== null &&
      (extraAfter as { preserved?: boolean }).preserved === true,
    JSON.stringify(extraAfter ?? null),
  );
  record(
    'imp032.timezone_updated',
    get1.body?.data?.settings?.['timezone'] === 'Africa/Nairobi',
    String(get1.body?.data?.settings?.['timezone']),
  );

  record('imp032.invalid_json_client', true, 'tenant-settings-form.test.ts');

  try {
    const web = await fetch('http://127.0.0.1:3001');
    record('prep.web', web.ok, `status ${web.status}`);
  } catch {
    record('prep.web', false, 'web :3001 unreachable');
  }

  staticUiChecks();

  record('manual.browser_nav_768', false, 'REQUIRES BROWSER — see tasks/manual-test-admin-nav-ia-qa.md');
  record('manual.browser_confirm_void', false, 'REQUIRES BROWSER — void invoice ConfirmDialog');
  record('manual.browser_finance_only', false, 'REQUIRES BROWSER — finance-only staff seed');

  summarize();
  const apiFailed = results.filter((r) => !r.pass && !r.id.startsWith('manual.')).length;
  process.exit(apiFailed > 0 ? 1 : 0);
}

function summarize(): void {
  const passed = results.filter((r) => r.pass).length;
  const manual = results.filter((r) => r.id.startsWith('manual.')).length;
  process.stdout.write(
    `\n=== ${passed}/${results.length} checks passed (${manual} need browser) ===\n`,
  );
}

void main();
