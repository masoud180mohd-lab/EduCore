import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import { AppError } from '../errors/app-error.js';
import { AUTH_CONTEXT_REQUEST_KEY } from '../auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../tenant/tenant.constants.js';
import { MapPermissionSource, PolicyEvaluator } from './policy-evaluator.js';
import { RequirePermission } from './require-permission.guard.js';

function mockContext(request: Record<string | symbol, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RequirePermission guard', () => {
  it('denies when auth context is missing', async () => {
    const Guard = RequirePermission('tenant.read');
    const evaluator = new PolicyEvaluator(new MapPermissionSource(new Map()));
    const guard = new Guard(evaluator);
    await expect(
      guard.canActivate(
        mockContext({
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 't1' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' } satisfies Partial<AppError>);
  });

  it('denies when tenant context is missing', async () => {
    const Guard = RequirePermission('tenant.read');
    const evaluator = new PolicyEvaluator(new MapPermissionSource(new Map()));
    const guard = new Guard(evaluator);
    await expect(
      guard.canActivate(
        mockContext({
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED' } satisfies Partial<AppError>);
  });

  it('allows when any required permission is present', async () => {
    const Guard = RequirePermission('tenant.manage', 'tenant.read');
    const evaluator = new PolicyEvaluator(
      new MapPermissionSource(new Map([['u1::t1', new Set(['tenant.read'])]])),
    );
    const guard = new Guard(evaluator);
    await expect(
      guard.canActivate(
        mockContext({
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1' },
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 't1' },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('forbids when none of the permissions match', async () => {
    const Guard = RequirePermission('role.manage');
    const requireAny = vi
      .fn()
      .mockRejectedValue(
        AppError.forbidden('Missing required permission.', { permissions: ['role.manage'] }),
      );
    const evaluator = { requireAny } as unknown as PolicyEvaluator;
    const guard = new Guard(evaluator);

    await expect(
      guard.canActivate(
        mockContext({
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1' },
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 't1' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<AppError>);
    expect(requireAny).toHaveBeenCalledWith('u1', 't1', ['role.manage']);
  });
});
