/** Re-export opaque token helpers from platform common (single implementation). */
export {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  accessExpiresAt,
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
  refreshExpiresAt,
} from '../../../common/auth/opaque-tokens.js';
