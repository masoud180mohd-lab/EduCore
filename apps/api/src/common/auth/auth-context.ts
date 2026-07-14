/**
 * Authenticated principal attached after token validation.
 * Full session claims (roles, MFA) arrive in later phases.
 */
export type AuthContext = {
  readonly userId: string;
  /** Opaque token id / session id when known; omitted for stub tokens. */
  readonly sessionId?: string;
  readonly tokenType: 'bearer';
};

export function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (authorizationHeader === undefined) {
    return undefined;
  }
  const trimmed = authorizationHeader.trim();
  if (trimmed === '') {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(trimmed);
  if (match === null) {
    return undefined;
  }
  const token = match[1];
  return token === undefined || token === '' ? undefined : token;
}
