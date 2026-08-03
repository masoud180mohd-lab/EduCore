/**
 * PAY-OPS-001: report ClickPesa / payment provider readiness without printing secrets.
 *
 * Usage (repo root):
 *   npm run payments:check-config
 *
 * Loads local `.env` keys for PAYMENT_* / CLICKPESA_* only (values never logged).
 * Exit 1 when PAYMENT_PROVIDER=clickpesa but secrets are incomplete.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  reportClickPesaConfig,
  type ClickPesaConfigReport,
} from '../apps/api/src/modules/payments/providers/clickpesa-config.js';

const ALLOWED_ENV_KEYS = new Set([
  'PAYMENT_PROVIDER',
  'CLICKPESA_BASE_URL',
  'CLICKPESA_CLIENT_ID',
  'CLICKPESA_API_KEY',
  'CLICKPESA_CHECKSUM_KEY',
]);

const root = fileURLToPath(new URL('../', import.meta.url));

/** Merge selected keys from a dotenv-style file into a copy of process.env (no logging of values). */
export function mergePaymentEnvFromDotenv(
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

export function formatClickPesaConfigReport(report: ClickPesaConfigReport): string {
  const lines = [
    'ClickPesa / payment provider config (values redacted)',
    `  requestedProvider:  ${report.requestedProvider}`,
    `  secretsPresent:     ${report.secretsPresent ? 'yes' : 'no'}`,
    `  missingSecrets:     ${report.missingSecrets.length === 0 ? '(none)' : report.missingSecrets.join(', ')}`,
    `  effectiveProvider:  ${report.effectiveProvider}`,
    `  baseUrlHost:        ${report.baseUrlHost}`,
  ];
  if (report.requestedProvider === 'clickpesa' && !report.secretsPresent) {
    lines.push(
      '',
      'Action: set missing CLICKPESA_* in local .env (gitignored), then restart Nest.',
      'See docs/engineering/task-records/PAY-OPS-001-clickpesa-sandbox-pilot.md',
    );
  } else if (report.effectiveProvider === 'fake') {
    lines.push('', 'Runtime will use FakePaymentProvider (CI/local default).');
  } else {
    lines.push('', 'Runtime should bind ClickPesaPaymentProvider (sandbox/lab).');
  }
  return `${lines.join('\n')}\n`;
}

export function exitCodeForReport(report: ClickPesaConfigReport): number {
  if (report.requestedProvider === 'clickpesa' && !report.secretsPresent) return 1;
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
    environment = mergePaymentEnvFromDotenv(process.env, readFileSync(envPath, 'utf8'));
  }
  const report = reportClickPesaConfig(environment);
  process.stdout.write(formatClickPesaConfigReport(report));
  process.exitCode = exitCodeForReport(report);
}
