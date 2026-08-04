/**
 * AI feature gate + config (AI-001 / AI-002).
 */

export const RUNTIME_AI_FEATURE_ALLOWLIST: ReadonlySet<string> = new Set(['lab.echo']);

export function isRuntimeAiFeatureAllowed(featureCode: string): boolean {
  return RUNTIME_AI_FEATURE_ALLOWLIST.has(featureCode);
}

export function isAiPlatformEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (environment['AI_PLATFORM_ENABLED'] ?? 'true').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');
}

export function resolveAiProviderName(
  environment: NodeJS.ProcessEnv = process.env,
): AiProviderName {
  const raw = (environment['AI_PROVIDER'] ?? 'fake').trim().toLowerCase();
  if (raw === 'disabled') return 'disabled';
  if (raw === 'openai') return 'openai';
  return 'fake';
}

export type AiProviderName = 'fake' | 'disabled' | 'openai';

export function aiDailyCapFromEnv(environment: NodeJS.ProcessEnv = process.env): number {
  const bypass = (environment['AI_BYPASS_DAILY_CAP'] ?? '').trim().toLowerCase();
  if (bypass === '1' || bypass === 'true' || bypass === 'yes') return -1;
  const raw = environment['AI_DAILY_CAP_PER_TENANT']?.trim();
  if (raw === undefined || raw === '') return 100;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 100;
}

/** Per-feature disable: AI_FEATURE_DISABLED=lab.echo,other */
export function isAiFeatureEnvDisabled(
  featureCode: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = environment['AI_FEATURE_DISABLED']?.trim() ?? '';
  if (raw === '') return false;
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== ''),
  );
  return set.has(featureCode);
}

/** Lab privacy stub — truncate long values; never log raw elsewhere. */
export function redactForAi(
  variables: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    const trimmed = value.trim();
    out[key] = trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
  }
  return out;
}

export function renderAiPromptBody(
  body: string,
  variables: Readonly<Record<string, string>>,
): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_full, rawKey: string) => {
    const key = rawKey.toLowerCase();
    return variables[key] ?? '';
  });
}

export function assertAiVariableAllowlist(
  allowlist: ReadonlyArray<string>,
  variables: Readonly<Record<string, string>>,
): void {
  const allowed = new Set(allowlist.map((k) => k.toLowerCase()));
  for (const key of Object.keys(variables)) {
    if (!allowed.has(key.toLowerCase())) {
      throw new Error(`Unknown placeholder: ${key}`);
    }
  }
}
