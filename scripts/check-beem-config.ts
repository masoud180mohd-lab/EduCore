/**
 * COMMS-004: report Beem / SMS provider readiness without printing secrets.
 *
 * Usage (repo root):
 *   npm run sms:check-config
 *
 * Loads local `.env` keys for SMS_* / BEEM_* only (values never logged).
 * Exit 1 when SMS_PROVIDER=beem but secrets are incomplete.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  reportBeemConfig,
  type BeemConfigReport,
} from '../apps/api/src/modules/communication/providers/beem-config.js';

const ALLOWED_ENV_KEYS = new Set([
  'SMS_PROVIDER',
  'SMS_DAILY_CAP_PER_TENANT',
  'BEEM_BASE_URL',
  'BEEM_API_KEY',
  'BEEM_SECRET_KEY',
  'BEEM_SOURCE_ADDR',
  'BEEM_WEBHOOK_SECRET',
]);

const root = fileURLToPath(new URL('../', import.meta.url));

/** Merge selected keys from a dotenv-style file into a copy of process.env (no logging of values). */
export function mergeSmsEnvFromDotenv(
  base: NodeJS.ProcessEnv,
  dotenvText: string,
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...base };
  for (const rawLine of dotenvText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!ALLOWED_ENV_KEYS.has(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    next[key] = value;
  }
  return next;
}

export function formatBeemConfigReport(report: BeemConfigReport): string {
  const lines = [
    'Beem / SMS provider config (values redacted)',
    `  requestedProvider:       ${report.requestedProvider}`,
    `  secretsPresent:          ${report.secretsPresent ? 'yes' : 'no'}`,
    `  missingSecrets:          ${report.missingSecrets.length === 0 ? '(none)' : report.missingSecrets.join(', ')}`,
    `  effectiveProvider:       ${report.effectiveProvider}`,
    `  baseUrlHost:             ${report.baseUrlHost}`,
    `  webhookSecretConfigured: ${report.webhookSecretConfigured ? 'yes' : 'no'}`,
  ];
  if (report.requestedProvider === 'beem' && !report.secretsPresent) {
    lines.push(
      '',
      'Action: set missing BEEM_* in local .env (gitignored), then restart Nest.',
      'See docs/engineering/task-records/COMMS-004-beem-sms-adapter.md',
    );
  } else if (report.effectiveProvider === 'fake') {
    lines.push('', 'Runtime will use FakeSmsProvider (CI/local default).');
  } else {
    lines.push('', 'Runtime should bind BeemSmsProvider.');
    if (!report.webhookSecretConfigured) {
      lines.push('Note: DLR webhook returns 501 until BEEM_WEBHOOK_SECRET is set.');
    }
  }
  return `${lines.join('\n')}\n`;
}

export function exitCodeForBeemReport(report: BeemConfigReport): number {
  if (report.requestedProvider === 'beem' && !report.secretsPresent) return 1;
  return 0;
}

function isExecutedDirectly(): boolean {
  const executedPath = process.argv[1];
  return executedPath !== undefined && import.meta.filename === executedPath;
}

if (isExecutedDirectly()) {
  const envPath = path.join(root, '.env');
  let environment: NodeJS.ProcessEnv = process.env;
  if (existsSync(envPath)) {
    environment = mergeSmsEnvFromDotenv(process.env, readFileSync(envPath, 'utf8'));
  }
  const report = reportBeemConfig(environment);
  process.stdout.write(formatBeemConfigReport(report));
  process.exitCode = exitCodeForBeemReport(report);
}
