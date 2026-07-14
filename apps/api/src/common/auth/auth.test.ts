import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import {
  AllowListTenantMembershipChecker,
  DenyAllTenantMembershipChecker,
} from '../tenant/index.js';
import { extractBearerToken } from './auth-context.js';
import { DevStubTokenValidator, RejectAllTokenValidator } from './token-validator.js';

describe('auth plumbing', () => {
  it('extracts Bearer tokens and rejects non-Bearer schemes', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('')).toBeUndefined();
  });

  it('rejects all tokens by default (fail-closed)', async () => {
    const validator = new RejectAllTokenValidator();
    await expect(validator.validateAccessToken('anything')).resolves.toBeNull();
  });

  it('dev stub accepts only dev: prefix tokens', async () => {
    const validator = new DevStubTokenValidator();
    await expect(validator.validateAccessToken('dev:user-1')).resolves.toEqual({
      userId: 'user-1',
      tokenType: 'bearer',
    });
    await expect(validator.validateAccessToken('real-jwt')).resolves.toBeNull();
  });

  it('membership checker denies by default and allows listed pairs', async () => {
    const deny = new DenyAllTenantMembershipChecker();
    await expect(deny.hasActiveMembership('u1', 't1')).resolves.toBe(false);

    const allow = new AllowListTenantMembershipChecker([{ userId: 'u1', tenantId: 't1' }]);
    await expect(allow.hasActiveMembership('u1', 't1')).resolves.toBe(true);
    await expect(allow.hasActiveMembership('u1', 't2')).resolves.toBe(false);
  });

  it('AppError helpers match ACF authz statuses', () => {
    expect(AppError.unauthorized().code).toBe('UNAUTHORIZED');
    expect(AppError.tenantMembershipRequired().code).toBe('TENANT_MEMBERSHIP_REQUIRED');
  });
});
