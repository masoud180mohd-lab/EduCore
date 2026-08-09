/**
 * WEB-AUTH0 — Auth0 Authorization Code + PKCE (browser).
 * Exchanges code via EduCore `POST /api/v1/auth/login` idpAssertion (opaque session).
 * Never stores Auth0 tokens as API bearers.
 */

const PKCE_STORAGE_KEY = 'educore.auth0.pkce';

export type Auth0PublicConfig = {
  readonly domain: string;
  readonly clientId: string;
  readonly audience: string | null;
};

export type Auth0PkcePending = {
  readonly state: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly createdAt: number;
};

export function normalizeAuth0Domain(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (value.startsWith('https://')) value = value.slice(8);
  if (value.startsWith('http://')) value = value.slice(7);
  return value.replace(/\/+$/, '');
}

/** Public Auth0 SPA/web config from Next env. Missing → Auth0 UI hidden. */
export function loadAuth0PublicConfig(
  environment: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {},
): Auth0PublicConfig | null {
  const domain = normalizeAuth0Domain(environment['NEXT_PUBLIC_AUTH0_DOMAIN'] ?? '');
  const clientId = (environment['NEXT_PUBLIC_AUTH0_CLIENT_ID'] ?? '').trim();
  if (domain === '' || clientId === '') return null;
  const audience = (environment['NEXT_PUBLIC_AUTH0_AUDIENCE'] ?? '').trim();
  return {
    domain,
    clientId,
    audience: audience === '' ? null : audience,
  };
}

export function auth0CallbackPath(): string {
  return '/auth/callback';
}

export function auth0RedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}${auth0CallbackPath()}`;
}

export function isAuth0Configured(): boolean {
  return loadAuth0PublicConfig() !== null;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

export function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export function writePkcePending(pending: Auth0PkcePending): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(pending));
}

export function readPkcePending(): Auth0PkcePending | null {
  const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
  if (raw === null || raw === '') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Auth0PkcePending>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.redirectUri !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }
    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      redirectUri: parsed.redirectUri,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function clearPkcePending(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
}

/** Max age for PKCE state (15 minutes). */
export const PKCE_MAX_AGE_MS = 15 * 60 * 1000;

export function buildAuth0AuthorizeUrl(input: {
  readonly config: Auth0PublicConfig;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
}): string {
  const url = new URL(`https://${input.config.domain}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.config.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (input.config.audience !== null) {
    url.searchParams.set('audience', input.config.audience);
  }
  return url.toString();
}

/**
 * Start Auth0 Universal Login (PKCE). Redirects the browser.
 * Throws if Auth0 public config is missing.
 */
export async function beginAuth0Login(origin: string = window.location.origin): Promise<void> {
  const config = loadAuth0PublicConfig();
  if (config === null) {
    throw new Error('Auth0 is not configured for this web build.');
  }
  const redirectUri = auth0RedirectUri(origin);
  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  writePkcePending({
    state,
    codeVerifier,
    redirectUri,
    createdAt: Date.now(),
  });
  window.location.assign(
    buildAuth0AuthorizeUrl({
      config,
      redirectUri,
      state,
      codeChallenge,
    }),
  );
}
