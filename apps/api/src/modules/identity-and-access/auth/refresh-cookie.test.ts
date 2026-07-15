import { describe, expect, it, vi } from 'vitest';

import {
  clearRefreshCookie,
  includeRefreshTokenInBody,
  readCookie,
  REFRESH_COOKIE_NAME,
  resolveRefreshToken,
  setRefreshCookie,
} from './refresh-cookie.js';

describe('refresh cookie helpers', () => {
  it('reads cookie values from Cookie header', () => {
    const req = {
      headers: { cookie: `${REFRESH_COOKIE_NAME}=ecr_abc; other=1` },
    } as never;
    expect(readCookie(req, REFRESH_COOKIE_NAME)).toBe('ecr_abc');
  });

  it('prefers body refresh token over cookie', () => {
    const req = {
      headers: { cookie: `${REFRESH_COOKIE_NAME}=from-cookie` },
    } as never;
    expect(resolveRefreshToken('from-body', req)).toBe('from-body');
    expect(resolveRefreshToken(undefined, req)).toBe('from-cookie');
  });

  it('sets and clears HttpOnly cookie options', () => {
    const cookie = vi.fn();
    const res = { cookie } as never;
    setRefreshCookie(res, 'ecr_tok', { NODE_ENV: 'development' });
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'ecr_tok',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/v1/auth',
      }),
    );
    clearRefreshCookie(res, { NODE_ENV: 'development' });
    expect(cookie).toHaveBeenLastCalledWith(
      REFRESH_COOKIE_NAME,
      '',
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });

  it('includes body refresh token unless EDUCORE_REFRESH_IN_BODY=0', () => {
    expect(includeRefreshTokenInBody({})).toBe(true);
    expect(includeRefreshTokenInBody({ EDUCORE_REFRESH_IN_BODY: '0' })).toBe(false);
  });
});
