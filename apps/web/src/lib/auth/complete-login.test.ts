import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/routing', () => ({
  resolvePostLoginPath: vi.fn(async () => '/t/tenant-1/admin'),
}));

vi.mock('@/lib/auth/session', () => ({
  writeSession: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/api/client';
import { completeLoginFromTokens, verifyMfaAndComplete } from './complete-login';

describe('completeLoginFromTokens', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('routes platform operators to /platform before tenant bind', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: { platformOperator: true },
    });

    const outcome = await completeLoginFromTokens({
      accessToken: 'tok',
      tenantId: null,
    });

    expect(outcome).toEqual({ kind: 'routed', path: '/platform' });
  });

  it('returns mfa_required when challenge token present', async () => {
    const outcome = await completeLoginFromTokens({
      accessToken: '',
      tenantId: 'tenant-1',
      mfaChallengeToken: 'ecm_challenge',
    });
    expect(outcome).toEqual({
      kind: 'mfa_required',
      mfaChallengeToken: 'ecm_challenge',
      tenantId: 'tenant-1',
    });
  });

  it('routes after MFA verify returns tokens', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: { accessToken: 'tok', tenantId: 'tenant-1' },
    });

    const outcome = await verifyMfaAndComplete({
      mfaChallengeToken: 'ecm_challenge',
      code: '123456',
    });

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/v1/auth/mfa/verify',
      expect.objectContaining({
        method: 'POST',
        body: { mfaChallengeToken: 'ecm_challenge', code: '123456' },
      }),
    );
    expect(outcome).toEqual({ kind: 'routed', path: '/t/tenant-1/admin' });
  });
});
