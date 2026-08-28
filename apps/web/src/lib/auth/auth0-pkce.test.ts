/**
 * WEB-AUTH0 PKCE helpers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  auth0RedirectUri,
  buildAuth0AuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  loadAuth0PublicConfig,
  normalizeAuth0Domain,
} from './auth0-pkce';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeAuth0Domain', () => {
  it('strips scheme and trailing slash', () => {
    expect(normalizeAuth0Domain('https://Dev-X.us.auth0.com/')).toBe('dev-x.us.auth0.com');
  });
});

describe('loadAuth0PublicConfig', () => {
  it('returns null when domain or client id missing', () => {
    expect(loadAuth0PublicConfig({})).toBeNull();
    expect(loadAuth0PublicConfig({ NEXT_PUBLIC_AUTH0_DOMAIN: 'tenant.us.auth0.com' })).toBeNull();
  });

  it('loads domain and client id', () => {
    expect(
      loadAuth0PublicConfig({
        NEXT_PUBLIC_AUTH0_DOMAIN: 'https://tenant.us.auth0.com/',
        NEXT_PUBLIC_AUTH0_CLIENT_ID: 'abc',
        NEXT_PUBLIC_AUTH0_AUDIENCE: 'https://api.example',
      }),
    ).toEqual({
      domain: 'tenant.us.auth0.com',
      clientId: 'abc',
      audience: 'https://api.example',
    });
  });

  it('uses static NEXT_PUBLIC_ process.env when no override map is passed', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH0_DOMAIN', 'https://from-env.us.auth0.com/');
    vi.stubEnv('NEXT_PUBLIC_AUTH0_CLIENT_ID', 'env-client');
    vi.stubEnv('NEXT_PUBLIC_AUTH0_AUDIENCE', '');
    expect(loadAuth0PublicConfig()).toEqual({
      domain: 'from-env.us.auth0.com',
      clientId: 'env-client',
      audience: null,
    });
  });
});

describe('PKCE challenge', () => {
  it('builds authorize URL with S256 challenge', async () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThan(20);
    const challenge = await generateCodeChallenge(verifier);
    const url = buildAuth0AuthorizeUrl({
      config: {
        domain: 'tenant.us.auth0.com',
        clientId: 'client-1',
        audience: null,
      },
      redirectUri: auth0RedirectUri('http://localhost:3001'),
      state: 'state-1',
      codeChallenge: challenge,
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://tenant.us.auth0.com');
    expect(parsed.pathname).toBe('/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBe(challenge);
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3001/auth/callback');
    expect(parsed.searchParams.get('scope')).toContain('openid');
  });
});
