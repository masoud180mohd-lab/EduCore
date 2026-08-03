/**
 * ClickPesa env config (PAY-002 / PAY-003 / PAY-OPS-001).
 * Secrets stay out of AppConfig dumps — load only when binding ClickPesa.
 */

export const CLICKPESA_PROVIDER_CODE = 'clickpesa';

export type ClickPesaConfig = {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly apiKey: string;
  readonly checksumKey: string;
};

export type ClickPesaSecretName =
  'CLICKPESA_CLIENT_ID' | 'CLICKPESA_API_KEY' | 'CLICKPESA_CHECKSUM_KEY';

/** Safe operator report — never includes secret values. */
export type ClickPesaConfigReport = {
  readonly requestedProvider: 'fake' | 'clickpesa';
  readonly secretsPresent: boolean;
  readonly missingSecrets: ReadonlyArray<ClickPesaSecretName>;
  /** What Nest will bind: clickpesa only when requested AND secrets present. */
  readonly effectiveProvider: 'fake' | 'clickpesa';
  /** Hostname only (no query/credentials). */
  readonly baseUrlHost: string;
};

export function loadClickPesaConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ClickPesaConfig | null {
  const clientId = environment['CLICKPESA_CLIENT_ID']?.trim() ?? '';
  const apiKey = environment['CLICKPESA_API_KEY']?.trim() ?? '';
  const checksumKey = environment['CLICKPESA_CHECKSUM_KEY']?.trim() ?? '';
  if (clientId === '' || apiKey === '' || checksumKey === '') {
    return null;
  }
  const baseUrl =
    environment['CLICKPESA_BASE_URL']?.trim() || 'https://api.clickpesa.com/third-parties';
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    clientId,
    apiKey,
    checksumKey,
  };
}

export function resolvePaymentProviderName(
  environment: NodeJS.ProcessEnv = process.env,
): 'fake' | 'clickpesa' {
  const raw = (environment['PAYMENT_PROVIDER'] ?? 'fake').trim().toLowerCase();
  return raw === 'clickpesa' ? 'clickpesa' : 'fake';
}

function listMissingClickPesaSecrets(
  environment: NodeJS.ProcessEnv,
): ReadonlyArray<ClickPesaSecretName> {
  const missing: ClickPesaSecretName[] = [];
  if ((environment['CLICKPESA_CLIENT_ID']?.trim() ?? '') === '') {
    missing.push('CLICKPESA_CLIENT_ID');
  }
  if ((environment['CLICKPESA_API_KEY']?.trim() ?? '') === '') {
    missing.push('CLICKPESA_API_KEY');
  }
  if ((environment['CLICKPESA_CHECKSUM_KEY']?.trim() ?? '') === '') {
    missing.push('CLICKPESA_CHECKSUM_KEY');
  }
  return missing;
}

function safeBaseUrlHost(environment: NodeJS.ProcessEnv): string {
  const raw =
    environment['CLICKPESA_BASE_URL']?.trim() || 'https://api.clickpesa.com/third-parties';
  try {
    return new URL(raw).host;
  } catch {
    return '(invalid CLICKPESA_BASE_URL)';
  }
}

/** PAY-OPS-001: operator-facing config report with no secret values. */
export function reportClickPesaConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ClickPesaConfigReport {
  const requestedProvider = resolvePaymentProviderName(environment);
  const missingSecrets = listMissingClickPesaSecrets(environment);
  const secretsPresent = missingSecrets.length === 0;
  const effectiveProvider =
    requestedProvider === 'clickpesa' && secretsPresent ? 'clickpesa' : 'fake';
  return {
    requestedProvider,
    secretsPresent,
    missingSecrets,
    effectiveProvider,
    baseUrlHost: safeBaseUrlHost(environment),
  };
}
