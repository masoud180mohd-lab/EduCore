import { createHash, randomBytes } from 'node:crypto';

/** Opaque access token prefix (not JWT). */
export const ACCESS_TOKEN_PREFIX = 'ecs_';
/** Opaque refresh token prefix. */
export const REFRESH_TOKEN_PREFIX = 'ecr_';

export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

/** SHA-256 hex digest for storage (credential-like). */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function accessExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
}

export function refreshExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
