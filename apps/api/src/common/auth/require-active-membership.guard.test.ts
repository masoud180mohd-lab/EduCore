import 'reflect-metadata';

import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import type { AppError } from '../errors/app-error.js';
import { AUTH_CONTEXT_REQUEST_KEY } from './auth.constants.js';
import { RequireActiveMembershipGuard } from './auth.guards.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../tenant/tenant.constants.js';
import { AllowListTenantMembershipChecker } from '../tenant/index.js';

function mockContext(request: Record<string | symbol, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RequireActiveMembershipGuard', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const tenantId = '22222222-2222-4222-8222-222222222222';

  it('allows when membership checker returns true', async () => {
    const guard = new RequireActiveMembershipGuard(
      new AllowListTenantMembershipChecker([{ userId, tenantId }]),
    );
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it('throws TENANT_MEMBERSHIP_REQUIRED when checker denies', async () => {
    const guard = new RequireActiveMembershipGuard(new AllowListTenantMembershipChecker([]));
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(guard.canActivate(mockContext(request))).rejects.toMatchObject({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
    } satisfies Partial<AppError>);
  });

  it('throws UNAUTHORIZED without auth context', async () => {
    const guard = new RequireActiveMembershipGuard(
      new AllowListTenantMembershipChecker([{ userId, tenantId }]),
    );
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(guard.canActivate(mockContext(request))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
