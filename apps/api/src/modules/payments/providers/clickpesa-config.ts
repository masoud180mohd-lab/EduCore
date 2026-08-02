/**
 * ClickPesa env config (PAY-002 / PAY-003).
 * Secrets stay out of AppConfig dumps — load only when binding ClickPesa.
 */

export const CLICKPESA_PROVIDER_CODE = 'clickpesa';

export type ClickPesaConfig = {
  readonly baseUrl: string;
  readonly clientId: string;
  readonly apiKey: string;
  readonly checksumKey: string;
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
