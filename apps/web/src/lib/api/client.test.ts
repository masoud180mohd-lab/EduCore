import { describe, expect, it } from 'vitest';

import { ApiClientError, teacherFriendlyMessage } from './client.js';

describe('teacherFriendlyMessage', () => {
  it('maps 401/403/404', () => {
    expect(
      teacherFriendlyMessage(
        new ApiClientError({ status: 401, code: 'UNAUTHORIZED', message: 'x' }),
      ),
    ).toBe('Sign in again.');
    expect(
      teacherFriendlyMessage(new ApiClientError({ status: 403, code: 'FORBIDDEN', message: 'x' })),
    ).toBe('You do not have access for this school.');
    expect(
      teacherFriendlyMessage(new ApiClientError({ status: 404, code: 'NOT_FOUND', message: 'x' })),
    ).toBe('Not found.');
  });

  it('maps closed session conflict', () => {
    expect(
      teacherFriendlyMessage(
        new ApiClientError({
          status: 409,
          code: 'CONFLICT',
          message: 'Attendance session is closed.',
        }),
      ),
    ).toMatch(/closed/i);
  });

  it('maps offline network error', () => {
    expect(
      teacherFriendlyMessage(
        new ApiClientError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }),
      ),
    ).toMatch(/offline/i);
  });

  it('maps MFA codes before generic 403', () => {
    expect(
      teacherFriendlyMessage(
        new ApiClientError({
          status: 403,
          code: 'MFA_REQUIRED',
          message: 'Privileged accounts must enroll TOTP before login (MFA_ENFORCE=hard).',
        }),
      ),
    ).toMatch(/Authenticator enrollment is required/i);
    expect(
      teacherFriendlyMessage(
        new ApiClientError({ status: 401, code: 'MFA_INVALID', message: 'bad' }),
      ),
    ).toMatch(/authenticator code/i);
  });
});
