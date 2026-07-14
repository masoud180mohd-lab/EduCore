import type { AuthContext } from './auth-context.js';

/**
 * Access-token / session validation surface (IMP-001-T17).
 * Production will resolve opaque sessions or pinned-algorithm JWT.
 * Default implementation rejects all tokens (deny-by-default).
 */
export interface TokenValidator {
  /**
   * @returns AuthContext when token is valid; null when invalid/revoked/unknown.
   */
  validateAccessToken(accessToken: string): Promise<AuthContext | null>;
}

export const TOKEN_VALIDATOR = Symbol('TOKEN_VALIDATOR');

export class RejectAllTokenValidator implements TokenValidator {
  validateAccessToken(_accessToken: string): Promise<AuthContext | null> {
    return Promise.resolve(null);
  }
}

/**
 * Test-only validator: accepts tokens of the form `dev:<userId>` where userId is a UUID-like string.
 * Never register this provider outside test harnesses.
 */
export class DevStubTokenValidator implements TokenValidator {
  validateAccessToken(accessToken: string): Promise<AuthContext | null> {
    if (!accessToken.startsWith('dev:')) {
      return Promise.resolve(null);
    }
    const userId = accessToken.slice('dev:'.length).trim();
    if (userId === '') {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      userId,
      tokenType: 'bearer',
    });
  }
}
