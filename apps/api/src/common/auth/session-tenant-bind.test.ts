import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import { assertSessionTenantMatchesHeader } from './session-tenant-bind.js';

describe('assertSessionTenantMatchesHeader', () => {
  it('returns session tenant when header matches (case-insensitive)', () => {
    const bound = assertSessionTenantMatchesHeader(
      { userId: 'u1', tenantId: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', tokenType: 'bearer' },
      { tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );
    expect(bound).toBe('AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA');
  });

  it('forbids when session has no bound tenant', () => {
    try {
      assertSessionTenantMatchesHeader({ userId: 'u1', tokenType: 'bearer' }, { tenantId: 't1' });
      expect.fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'FORBIDDEN',
        details: { reason: 'SESSION_TENANT_UNBOUND' },
      });
    }
  });

  it('forbids when X-Tenant-Id mismatches session tenant (403)', () => {
    try {
      assertSessionTenantMatchesHeader(
        { userId: 'u1', tenantId: 'tenant-session', tokenType: 'bearer' },
        { tenantId: 'tenant-header' },
      );
      expect.fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403,
        details: { reason: 'SESSION_TENANT_MISMATCH' },
      });
    }
  });
});
