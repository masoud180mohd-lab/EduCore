import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../api/client.js';

import { adminFriendlyMessage } from './admin-friendly-message.js';

const err = (status: number, message = 'x', code = 'HTTP_ERROR') =>
  new ApiClientError({ status, code, message });

describe('adminFriendlyMessage', () => {
  it('maps 401/404 via shared core', () => {
    expect(adminFriendlyMessage(err(401), 'users')).toBe('Sign in again.');
    expect(adminFriendlyMessage(err(404), 'students')).toBe('Not found.');
  });

  it('maps 403 per domain', () => {
    expect(adminFriendlyMessage(err(403), 'users')).toBe('You do not have access for this action.');
    expect(adminFriendlyMessage(err(403), 'finance')).toBe('You do not have finance access.');
    expect(adminFriendlyMessage(err(403), 'finance', { action: 'reconcile' })).toBe(
      'You do not have finance reconcile access.',
    );
    expect(adminFriendlyMessage(err(403), 'tenant')).toBe(
      'You do not have access for this school.',
    );
  });

  it('prefers API 409 message; domain fallback when empty', () => {
    expect(adminFriendlyMessage(err(409, 'Invoice already voided.'), 'finance')).toBe(
      'Invoice already voided.',
    );
    expect(adminFriendlyMessage(err(409, ''), 'students')).toBe(
      'Conflict — duplicate student code.',
    );
    expect(adminFriendlyMessage(err(409, '   '), 'academic')).toBe(
      'Conflict — duplicate code or state.',
    );
  });

  it('maps network and idempotency via shared core', () => {
    expect(
      adminFriendlyMessage(
        new ApiClientError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }),
        'generic',
      ),
    ).toMatch(/offline/i);
    expect(
      adminFriendlyMessage(
        new ApiClientError({
          status: 400,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'x',
        }),
        'users',
      ),
    ).toMatch(/retry key missing/i);
  });
});
