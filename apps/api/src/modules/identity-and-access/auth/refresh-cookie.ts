import type { Request, Response } from 'express';

import { REFRESH_TOKEN_TTL_SECONDS } from './session-tokens.js';

/** HttpOnly refresh cookie name (ACF-001 browser path). */
export const REFRESH_COOKIE_NAME = 'ecr_refresh';

/** Cookie path limited to auth routes (reduces CSRF surface on other APIs). */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * When true (default), login/refresh still return refreshToken in JSON body
 * for non-browser API clients. Set EDUCORE_REFRESH_IN_BODY=0 to cookie-only.
 */
export function includeRefreshTokenInBody(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment['EDUCORE_REFRESH_IN_BODY'] !== '0';
}

export function isSecureCookie(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (environment['EDUCORE_COOKIE_SECURE'] === '1') {
    return true;
  }
  if (environment['EDUCORE_COOKIE_SECURE'] === '0') {
    return false;
  }
  return environment['NODE_ENV'] === 'production';
}

export function setRefreshCookie(
  response: Response,
  refreshToken: string,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isSecureCookie(environment),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(
  response: Response,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  response.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureCookie(environment),
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}

/** Parse a single cookie value without cookie-parser middleware. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined || header === '') {
    return undefined;
  }
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) {
      continue;
    }
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/**
 * Resolve refresh credential: body.refreshToken wins (API clients),
 * then HttpOnly cookie (browsers).
 */
export function resolveRefreshToken(bodyRefresh: unknown, request: Request): string | undefined {
  if (typeof bodyRefresh === 'string' && bodyRefresh.trim() !== '') {
    return bodyRefresh.trim();
  }
  const fromCookie = readCookie(request, REFRESH_COOKIE_NAME);
  if (fromCookie !== undefined && fromCookie.trim() !== '') {
    return fromCookie.trim();
  }
  return undefined;
}
