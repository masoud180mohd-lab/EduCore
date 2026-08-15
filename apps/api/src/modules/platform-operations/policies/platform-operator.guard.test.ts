import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { RequirePlatformOperator } from './platform-operator.guard.js';

const userId = '01900000-0000-7000-8000-000000000001';

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

describe('RequirePlatformOperator', () => {
  it('rejects unauthenticated requests', async () => {
    const Guard = RequirePlatformOperator();
    const guard = new Guard({ isActiveSuperAdmin: vi.fn() } as never, null);
    await expect(guard.canActivate(context({}) as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects X-Tenant-Id', async () => {
    const Guard = RequirePlatformOperator();
    const operators = { isActiveSuperAdmin: vi.fn() };
    const guard = new Guard(operators as never, null);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId },
      header: (name: string) => (name === 'x-tenant-id' ? userId : undefined),
    };
    await expect(guard.canActivate(context(request) as never)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(operators.isActiveSuperAdmin).not.toHaveBeenCalled();
  });

  it('rejects tenant context even without a header string', async () => {
    const Guard = RequirePlatformOperator();
    const guard = new Guard({ isActiveSuperAdmin: vi.fn() } as never, null);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: userId },
      header: () => undefined,
    };
    await expect(guard.canActivate(context(request) as never)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('forbids users who are not active super admins', async () => {
    const Guard = RequirePlatformOperator();
    const guard = new Guard({ isActiveSuperAdmin: vi.fn().mockResolvedValue(false) } as never, null);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId },
      header: () => undefined,
    };
    await expect(guard.canActivate(context(request) as never)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows an active super admin on read routes without MFA', async () => {
    const Guard = RequirePlatformOperator();
    const mfa = { assertAccess: vi.fn() };
    const guard = new Guard({ isActiveSuperAdmin: vi.fn().mockResolvedValue(true) } as never, mfa as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId },
      header: () => undefined,
    };
    await expect(guard.canActivate(context(request) as never)).resolves.toBe(true);
    expect(mfa.assertAccess).not.toHaveBeenCalled();
  });

  it('requires MFA on write routes', async () => {
    const Guard = RequirePlatformOperator({ write: true });
    const mfa = { assertAccess: vi.fn().mockResolvedValue(undefined) };
    const guard = new Guard({ isActiveSuperAdmin: vi.fn().mockResolvedValue(true) } as never, mfa as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId },
      header: () => undefined,
    };
    await expect(guard.canActivate(context(request) as never)).resolves.toBe(true);
    expect(mfa.assertAccess).toHaveBeenCalled();
  });
});
