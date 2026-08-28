/**
 * ID-003: Auth0 / IdP runtime config (secrets never dumped).
 * Default AUTH_IDP_PROVIDER=local keeps assertion login disabled.
 */

export type AuthIdpProviderName = 'local' | 'auth0';

export type Auth0Config = {
  readonly domain: string;
  readonly clientId: string;
  /** Optional API audience; ID tokens use clientId as aud by default. */
  readonly audience: string | null;
  /** Confidential clients only — SPA/PKCE may omit. */
  readonly clientSecret: string | null;
};

export type Auth0SecretName = 'AUTH0_DOMAIN' | 'AUTH0_CLIENT_ID';

export type AuthIdpConfigReport = {
  readonly requestedProvider: AuthIdpProviderName;
  readonly secretsPresent: boolean;
  readonly missingSecrets: ReadonlyArray<Auth0SecretName>;
  /** Assertion path is live only when auth0 + domain/clientId present. */
  readonly assertionEnabled: boolean;
  readonly issuerHost: string;
};

export function resolveAuthIdpProvider(
  environment: NodeJS.ProcessEnv = process.env,
): AuthIdpProviderName {
  const raw = (environment['AUTH_IDP_PROVIDER'] ?? 'local').trim().toLowerCase();
  return raw === 'auth0' ? 'auth0' : 'local';
}

export function loadAuth0Config(environment: NodeJS.ProcessEnv = process.env): Auth0Config | null {
  const domain = normalizeAuth0Domain(environment['AUTH0_DOMAIN']?.trim() ?? '');
  const clientId = environment['AUTH0_CLIENT_ID']?.trim() ?? '';
  if (domain === '' || clientId === '') {
    return null;
  }
  const audience = environment['AUTH0_AUDIENCE']?.trim() || null;
  const clientSecret = environment['AUTH0_CLIENT_SECRET']?.trim() || null;
  return {
    domain,
    clientId,
    audience: audience === '' ? null : audience,
    clientSecret: clientSecret === '' ? null : clientSecret,
  };
}

export function auth0Issuer(domain: string): string {
  return `https://${normalizeAuth0Domain(domain)}/`;
}

export function auth0JwksUrl(domain: string): string {
  return `https://${normalizeAuth0Domain(domain)}/.well-known/jwks.json`;
}

export function auth0TokenUrl(domain: string): string {
  return `https://${normalizeAuth0Domain(domain)}/oauth/token`;
}

function normalizeAuth0Domain(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (value.startsWith('https://')) {
    value = value.slice('https://'.length);
  } else if (value.startsWith('http://')) {
    value = value.slice('http://'.length);
  }
  return value.replace(/\/+$/, '');
}

function listMissingAuth0Secrets(environment: NodeJS.ProcessEnv): ReadonlyArray<Auth0SecretName> {
  const missing: Auth0SecretName[] = [];
  if (normalizeAuth0Domain(environment['AUTH0_DOMAIN']?.trim() ?? '') === '') {
    missing.push('AUTH0_DOMAIN');
  }
  if ((environment['AUTH0_CLIENT_ID']?.trim() ?? '') === '') {
    missing.push('AUTH0_CLIENT_ID');
  }
  return missing;
}

/** Operator report — never includes secret values. */
export function reportAuthIdpConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthIdpConfigReport {
  const requestedProvider = resolveAuthIdpProvider(environment);
  const missingSecrets = listMissingAuth0Secrets(environment);
  const secretsPresent = missingSecrets.length === 0;
  const assertionEnabled = requestedProvider === 'auth0' && secretsPresent;
  const domain = normalizeAuth0Domain(environment['AUTH0_DOMAIN']?.trim() ?? '');
  return {
    requestedProvider,
    secretsPresent,
    missingSecrets,
    assertionEnabled,
    issuerHost: domain === '' ? '(unset)' : domain,
  };
}
