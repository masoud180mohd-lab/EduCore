import { describe, expect, it, vi } from 'vitest';

import { SessionTokenValidator } from './session-token.validator.js';

describe('SessionTokenValidator', () => {
  it('returns null when lookup is unavailable', async () => {
    const validator = new SessionTokenValidator(null, (t) => `h:${t}`);
    await expect(validator.validateAccessToken('ecs_abc')).resolves.toBeNull();
  });

  it('returns AuthContext for active non-expired session', async () => {
    const lookup = {
      findByAccessTokenHash: vi.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'active',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      touchSession: vi.fn().mockResolvedValue(undefined),
    };
    const validator = new SessionTokenValidator(lookup, (t) => `hash(${t})`);
    await expect(validator.validateAccessToken('ecs_tok')).resolves.toEqual({
      userId: 'user-1',
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      tokenType: 'bearer',
    });
    expect(lookup.findByAccessTokenHash).toHaveBeenCalledWith('hash(ecs_tok)');
  });

  it('rejects revoked or expired sessions', async () => {
    const lookup = {
      findByAccessTokenHash: vi.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      touchSession: vi.fn(),
    };
    const validator = new SessionTokenValidator(lookup, (t) => t);
    await expect(validator.validateAccessToken('x')).resolves.toBeNull();

    lookup.findByAccessTokenHash.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      status: 'active',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(validator.validateAccessToken('x')).resolves.toBeNull();
  });
});
