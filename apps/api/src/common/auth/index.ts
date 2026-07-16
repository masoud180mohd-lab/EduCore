export { AUTH_CONTEXT_REQUEST_KEY, AUTHORIZATION_HEADER } from './auth.constants.js';
export type { AuthContext } from './auth-context.js';
export { extractBearerToken } from './auth-context.js';
export { assertSessionTenantMatchesHeader } from './session-tenant-bind.js';
export { AuthContextMiddleware } from './auth-context.middleware.js';
export type { RequestWithAuth } from './auth-context.middleware.js';
export type { TokenValidator } from './token-validator.js';
export {
  DevStubTokenValidator,
  RejectAllTokenValidator,
  TOKEN_VALIDATOR,
} from './token-validator.js';
export {
  RequireActiveMembershipGuard,
  RequireAuthGuard,
  RequireTenantContextGuard,
} from './auth.guards.js';
export { SESSION_ACCESS_LOOKUP, SessionTokenValidator } from './session-token.validator.js';
export type { SessionAccessLookup, TokenHasher } from './session-token.validator.js';
export {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  accessExpiresAt,
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
  refreshExpiresAt,
} from './opaque-tokens.js';
