/**
 * AI-006: report OpenAI / AI provider readiness without printing secrets.
 *
 * Usage (repo root):
 *   npm run ai:check-config
 *
 * Exit 1 when AI_PROVIDER=openai but OPENAI_API_KEY is missing.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  reportOpenAiConfig,
  type OpenAiConfigReport,
} from '../apps/api/src/modules/ai-gateway/providers/openai-config.js';

const ALLOWED_ENV_KEYS = new Set([
  'AI_PROVIDER',
  'AI_PLATFORM_ENABLED',
  'AI_DAILY_CAP_PER_TENANT',
  'AI_BYPASS_DAILY_CAP',
  'AI_FEATURE_DISABLED',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
]);

const root = fileURLToPath(new URL('../', import.meta.url));

export function mergeAiEnvFromDotenv(
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

export function formatOpenAiConfigReport(report: OpenAiConfigReport): string {
  const lines = [
    'OpenAI / AI provider config (values redacted)',
    `  requestedProvider:  ${report.requestedProvider}`,
    `  secretsPresent:     ${report.secretsPresent ? 'yes' : 'no'}`,
    `  missingSecrets:     ${report.missingSecrets.length === 0 ? '(none)' : report.missingSecrets.join(', ')}`,
    `  effectiveProvider:  ${report.effectiveProvider}`,
    `  baseUrlHost:        ${report.baseUrlHost}`,
    `  model:              ${report.model}`,
  ];
  if (report.requestedProvider === 'openai' && !report.secretsPresent) {
    lines.push(
      '',
      'Action: set OPENAI_API_KEY in local .env (gitignored), or set AI_PROVIDER=fake.',
      'ACF-AI-006: openai without keys → 501 / provider_not_configured (never silent Fake).',
    );
  } else if (report.effectiveProvider === 'fake') {
    lines.push('', 'Runtime will use FakeAiProvider (CI/local default).');
  } else if (report.effectiveProvider === 'disabled') {
    lines.push('', 'AI platform/provider disabled — invokes settle as disabled.');
  } else {
    lines.push('', 'Runtime should bind OpenAiAiProvider.');
  }
  return `${lines.join('\n')}\n`;
}

export function exitCodeForOpenAiReport(report: OpenAiConfigReport): number {
  if (report.requestedProvider === 'openai' && !report.secretsPresent) return 1;
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
    environment = mergeAiEnvFromDotenv(process.env, readFileSync(envPath, 'utf8'));
  }
  const report = reportOpenAiConfig(environment);
  process.stdout.write(formatOpenAiConfigReport(report));
  process.exitCode = exitCodeForOpenAiReport(report);
}
