import * as jose from 'jose';
import { describe, expect, it, vi } from 'vitest';

import {
  Auth0IdpAssertionVerifier,
  createIdpAssertionVerifier,
  parseIdpAssertion,
} from './idp-assertion.verifier.js';

describe('parseIdpAssertion', () => {
  it('accepts compact JWT and JSON idToken / code payloads', () => {
    expect(parseIdpAssertion('aaa.bbb.ccc')).toEqual({
      kind: 'id_token',
      idToken: 'aaa.bbb.ccc',
    });
    expect(parseIdpAssertion(JSON.stringify({ idToken: 'x.y.z' }))).toEqual({
      kind: 'id_token',
      idToken: 'x.y.z',
    });
    expect(
      parseIdpAssertion(
        JSON.stringify({
          code: 'authcode',
          redirectUri: 'https://app.example/callback',
          codeVerifier: 'verifier',
        }),
      ),
    ).toEqual({
      kind: 'authorization_code',
      code: 'authcode',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier',
    });
    expect(
      parseIdpAssertion({
        code: 'authcode',
        redirectUri: 'https://app.example/callback',
        codeVerifier: 'verifier',
      }),
    ).toEqual({
      kind: 'authorization_code',
      code: 'authcode',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier',
    });
    expect(parseIdpAssertion('not-a-token')).toBeNull();
  });
});

describe('Auth0IdpAssertionVerifier', () => {
  it('verifies RS256 ID tokens against configured issuer/audience', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
    const getKey = jose.createLocalJWKSet({
      keys: [await jose.exportJWK(publicKey)],
    });

    const idToken = await new jose.SignJWT({
      email: 'admin@educore.staging',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('auth0|user-1')
      .setIssuer('https://tenant.eu.auth0.com/')
      .setAudience('spa-client')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const verifier = new Auth0IdpAssertionVerifier(
      {
        domain: 'tenant.eu.auth0.com',
        clientId: 'spa-client',
        audience: null,
        clientSecret: null,
      },
      fetch,
      getKey,
    );

    await expect(verifier.verify(idToken)).resolves.toEqual({
      subject: 'auth0|user-1',
      email: 'admin@educore.staging',
      emailVerified: true,
    });
  });

  it('exchanges authorization code then verifies id_token', async () => {
    const { privateKey, publicKey } = await jose.generateKeyPair('RS256');
    const getKey = jose.createLocalJWKSet({
      keys: [await jose.exportJWK(publicKey)],
    });

    const idToken = await new jose.SignJWT({ email_verified: true, email: 'a@b.co' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('auth0|2')
      .setIssuer('https://tenant.eu.auth0.com/')
      .setAudience('spa-client')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const fetchMock: typeof fetch = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify({ id_token: idToken }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    );

    const verifier = new Auth0IdpAssertionVerifier(
      {
        domain: 'tenant.eu.auth0.com',
        clientId: 'spa-client',
        audience: null,
        clientSecret: 'secret',
      },
      fetchMock,
      getKey,
    );

    await expect(
      verifier.verify(
        JSON.stringify({
          code: 'abc',
          redirectUri: 'https://app.example/cb',
          codeVerifier: 'pkce',
        }),
      ),
    ).resolves.toMatchObject({ subject: 'auth0|2', email: 'a@b.co' });
  });
});

describe('createIdpAssertionVerifier', () => {
  it('returns disabled verifier for local provider', async () => {
    const verifier = createIdpAssertionVerifier({ AUTH_IDP_PROVIDER: 'local' });
    await expect(verifier.verify('a.b.c')).rejects.toThrowError(/not enabled/);
  });

  it('fails closed when auth0 selected without secrets', async () => {
    const verifier = createIdpAssertionVerifier({ AUTH_IDP_PROVIDER: 'auth0' });
    await expect(verifier.verify('a.b.c')).rejects.toMatchObject({ statusCode: 503 });
  });
});
