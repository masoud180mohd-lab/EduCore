/**
 * ID-003: verify Auth0 id_token (or auth-code → id_token) before minting EduCore sessions.
 */

import * as jose from 'jose';

import { AppError } from '../../../common/errors/app-error.js';
import {
  auth0Issuer,
  auth0JwksUrl,
  auth0TokenUrl,
  loadAuth0Config,
  resolveAuthIdpProvider,
  type Auth0Config,
} from './auth-idp-config.js';

export const IDP_ASSERTION_VERIFIER = Symbol('IDP_ASSERTION_VERIFIER');

export type IdpVerifiedClaims = {
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
};

export type IdpAssertionVerifier = {
  verify(assertion: unknown): Promise<IdpVerifiedClaims>;
};

export class DisabledIdpAssertionVerifier implements IdpAssertionVerifier {
  verify(_assertion: unknown): Promise<IdpVerifiedClaims> {
    return Promise.reject(
      AppError.validation('IdP assertion login is not enabled in this environment.'),
    );
  }
}

export class MisconfiguredAuth0IdpAssertionVerifier implements IdpAssertionVerifier {
  verify(_assertion: unknown): Promise<IdpVerifiedClaims> {
    return Promise.reject(
      new AppError(
        'INTERNAL_ERROR',
        'Auth0 IdP is selected but AUTH0_DOMAIN / AUTH0_CLIENT_ID are not configured.',
        503,
      ),
    );
  }
}

type ParsedAssertion =
  | { readonly kind: 'id_token'; readonly idToken: string }
  | {
      readonly kind: 'authorization_code';
      readonly code: string;
      readonly redirectUri: string;
      readonly codeVerifier: string | null;
    };

export class Auth0IdpAssertionVerifier implements IdpAssertionVerifier {
  private readonly getKey: jose.JWTVerifyGetKey;

  constructor(
    private readonly config: Auth0Config,
    private readonly fetchImpl: typeof fetch = fetch,
    getKey?: jose.JWTVerifyGetKey,
  ) {
    this.getKey = getKey ?? jose.createRemoteJWKSet(new URL(auth0JwksUrl(config.domain)));
  }

  async verify(assertion: unknown): Promise<IdpVerifiedClaims> {
    const parsed = parseIdpAssertion(assertion);
    if (parsed === null) {
      throw AppError.validation(
        'idpAssertion must be an Auth0 ID token string or JSON { idToken } / { code, redirectUri }.',
      );
    }

    const idToken =
      parsed.kind === 'id_token' ? parsed.idToken : await this.exchangeAuthorizationCode(parsed);

    return this.verifyIdToken(idToken);
  }

  private async exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly redirectUri: string;
    readonly codeVerifier: string | null;
  }): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code: input.code,
      redirect_uri: input.redirectUri,
    });
    if (this.config.clientSecret !== null) {
      body.set('client_secret', this.config.clientSecret);
    }
    if (input.codeVerifier !== null) {
      body.set('code_verifier', input.codeVerifier);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(auth0TokenUrl(this.config.domain), {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'accept': 'application/json',
        },
        body,
      });
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Failed to reach Auth0 token endpoint.', 503);
    }

    const payload = (await response.json().catch(() => null)) as {
      id_token?: unknown;
      error?: unknown;
    } | null;

    if (!response.ok || payload === null || typeof payload.id_token !== 'string') {
      throw AppError.invalidCredentials();
    }
    return payload.id_token;
  }

  private async verifyIdToken(idToken: string): Promise<IdpVerifiedClaims> {
    const issuer = auth0Issuer(this.config.domain);
    const audience =
      this.config.audience !== null
        ? [this.config.clientId, this.config.audience]
        : this.config.clientId;

    let payload: jose.JWTPayload;
    try {
      const verified = await jose.jwtVerify(idToken, this.getKey, {
        issuer,
        audience,
        algorithms: ['RS256'],
      });
      payload = verified.payload;
    } catch {
      throw AppError.invalidCredentials();
    }

    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    if (subject === '') {
      throw AppError.invalidCredentials();
    }

    const email =
      typeof payload['email'] === 'string' ? payload['email'].trim().toLowerCase() : null;
    const emailVerified = payload['email_verified'] === true;

    return {
      subject,
      email: email !== null && email.includes('@') ? email : null,
      emailVerified,
    };
  }
}

export function parseIdpAssertion(raw: unknown): ParsedAssertion | null {
  // WEB-AUTH0: browser may POST a JSON object (not only a stringified payload).
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return parseAssertionObject(raw as Record<string, unknown>);
  }

  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parseAssertionObject(parsed as Record<string, unknown>);
  }

  // Compact JWT: header.payload.sig
  if (trimmed.split('.').length === 3) {
    return { kind: 'id_token', idToken: trimmed };
  }
  return null;
}

function parseAssertionObject(obj: Record<string, unknown>): ParsedAssertion | null {
  if (typeof obj['idToken'] === 'string' && obj['idToken'].trim() !== '') {
    return { kind: 'id_token', idToken: obj['idToken'].trim() };
  }
  if (typeof obj['code'] === 'string' && obj['code'].trim() !== '') {
    const redirectUri = typeof obj['redirectUri'] === 'string' ? obj['redirectUri'].trim() : '';
    if (redirectUri === '') {
      return null;
    }
    const codeVerifier =
      typeof obj['codeVerifier'] === 'string' && obj['codeVerifier'].trim() !== ''
        ? obj['codeVerifier'].trim()
        : null;
    return {
      kind: 'authorization_code',
      code: obj['code'].trim(),
      redirectUri,
      codeVerifier,
    };
  }
  return null;
}

export function createIdpAssertionVerifier(
  environment: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): IdpAssertionVerifier {
  if (resolveAuthIdpProvider(environment) !== 'auth0') {
    return new DisabledIdpAssertionVerifier();
  }
  const config = loadAuth0Config(environment);
  if (config === null) {
    return new MisconfiguredAuth0IdpAssertionVerifier();
  }
  return new Auth0IdpAssertionVerifier(config, fetchImpl);
}
