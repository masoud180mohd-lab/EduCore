/**
 * OpenAI env config (AI-006). Secrets never dumped via AppConfig.
 */

import { resolveAiProviderName, type AiProviderName } from '../application/ai-feature-gate.js';

export const OPENAI_PROVIDER_CODE = 'openai';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export type OpenAiConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
};

export type OpenAiConfigReport = {
  readonly requestedProvider: AiProviderName;
  readonly secretsPresent: boolean;
  readonly missingSecrets: ReadonlyArray<'OPENAI_API_KEY'>;
  /** Bound provider: openai only when requested AND key present; never silent Fake for openai. */
  readonly effectiveProvider: 'fake' | 'disabled' | 'openai' | 'openai_unconfigured';
  readonly baseUrlHost: string;
  readonly model: string;
};

export function loadOpenAiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAiConfig | null {
  const apiKey = environment['OPENAI_API_KEY']?.trim() ?? '';
  if (apiKey === '') return null;
  const baseUrl = (environment['OPENAI_BASE_URL']?.trim() || DEFAULT_OPENAI_BASE_URL).replace(
    /\/$/,
    '',
  );
  const model = environment['OPENAI_MODEL']?.trim() || DEFAULT_OPENAI_MODEL;
  return { apiKey, baseUrl, model };
}

export function reportOpenAiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAiConfigReport {
  const requestedProvider = resolveAiProviderName(environment);
  const missingSecrets: Array<'OPENAI_API_KEY'> = [];
  if ((environment['OPENAI_API_KEY']?.trim() ?? '') === '') {
    missingSecrets.push('OPENAI_API_KEY');
  }
  const secretsPresent = missingSecrets.length === 0;
  let effectiveProvider: OpenAiConfigReport['effectiveProvider'] = 'fake';
  if (requestedProvider === 'disabled') {
    effectiveProvider = 'disabled';
  } else if (requestedProvider === 'openai') {
    effectiveProvider = secretsPresent ? 'openai' : 'openai_unconfigured';
  }
  return {
    requestedProvider,
    secretsPresent,
    missingSecrets,
    effectiveProvider,
    baseUrlHost: safeHost(environment['OPENAI_BASE_URL']?.trim() || DEFAULT_OPENAI_BASE_URL),
    model: environment['OPENAI_MODEL']?.trim() || DEFAULT_OPENAI_MODEL,
  };
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return '(invalid OPENAI_BASE_URL)';
  }
}
