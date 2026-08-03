/**
 * Beem SMS env config (COMMS-001 / COMMS-004).
 * Secrets stay out of AppConfig dumps — load only when binding Beem.
 */

export const BEEM_PROVIDER_CODE = 'beem';

export type BeemConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly secretKey: string;
  readonly sourceAddr: string;
};

export type BeemSecretName = 'BEEM_API_KEY' | 'BEEM_SECRET_KEY' | 'BEEM_SOURCE_ADDR';

/** Safe operator report — never includes secret values. */
export type BeemConfigReport = {
  readonly requestedProvider: 'fake' | 'beem';
  readonly secretsPresent: boolean;
  readonly missingSecrets: ReadonlyArray<BeemSecretName>;
  /** What Nest will bind: beem only when requested AND secrets present. */
  readonly effectiveProvider: 'fake' | 'beem';
  /** Hostname only (no query/credentials). */
  readonly baseUrlHost: string;
  readonly webhookSecretConfigured: boolean;
};

export function loadBeemConfig(environment: NodeJS.ProcessEnv = process.env): BeemConfig | null {
  const apiKey = environment['BEEM_API_KEY']?.trim() ?? '';
  const secretKey = environment['BEEM_SECRET_KEY']?.trim() ?? '';
  const sourceAddr = environment['BEEM_SOURCE_ADDR']?.trim() ?? '';
  if (apiKey === '' || secretKey === '' || sourceAddr === '') {
    return null;
  }
  const baseUrl = environment['BEEM_BASE_URL']?.trim() || 'https://apisms.beem.africa';
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    secretKey,
    sourceAddr,
  };
}

export function resolveSmsProviderName(
  environment: NodeJS.ProcessEnv = process.env,
): 'fake' | 'beem' {
  const raw = (environment['SMS_PROVIDER'] ?? 'fake').trim().toLowerCase();
  return raw === 'beem' ? 'beem' : 'fake';
}

export function loadBeemWebhookSecret(environment: NodeJS.ProcessEnv = process.env): string | null {
  const secret = environment['BEEM_WEBHOOK_SECRET']?.trim() ?? '';
  return secret === '' ? null : secret;
}

function listMissingBeemSecrets(environment: NodeJS.ProcessEnv): ReadonlyArray<BeemSecretName> {
  const missing: BeemSecretName[] = [];
  if ((environment['BEEM_API_KEY']?.trim() ?? '') === '') {
    missing.push('BEEM_API_KEY');
  }
  if ((environment['BEEM_SECRET_KEY']?.trim() ?? '') === '') {
    missing.push('BEEM_SECRET_KEY');
  }
  if ((environment['BEEM_SOURCE_ADDR']?.trim() ?? '') === '') {
    missing.push('BEEM_SOURCE_ADDR');
  }
  return missing;
}

function safeBaseUrlHost(environment: NodeJS.ProcessEnv): string {
  const raw = environment['BEEM_BASE_URL']?.trim() || 'https://apisms.beem.africa';
  try {
    return new URL(raw).host;
  } catch {
    return '(invalid BEEM_BASE_URL)';
  }
}

/** Operator-facing config report with no secret values. */
export function reportBeemConfig(environment: NodeJS.ProcessEnv = process.env): BeemConfigReport {
  const requestedProvider = resolveSmsProviderName(environment);
  const missingSecrets = listMissingBeemSecrets(environment);
  const secretsPresent = missingSecrets.length === 0;
  const effectiveProvider = requestedProvider === 'beem' && secretsPresent ? 'beem' : 'fake';
  return {
    requestedProvider,
    secretsPresent,
    missingSecrets,
    effectiveProvider,
    baseUrlHost: safeBaseUrlHost(environment),
    webhookSecretConfigured: loadBeemWebhookSecret(environment) !== null,
  };
}
