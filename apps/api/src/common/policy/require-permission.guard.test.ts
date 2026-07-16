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
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1', tenantId: 't1', tokenType: 'bearer' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED' } satisfies Partial<AppError>);
  });

  it('forbids when X-Tenant-Id mismatches session tenant (403)', async () => {
    const Guard = RequirePermission('tenant.read');
    const requireAny = vi.fn();
    const evaluator = { requireAny } as unknown as PolicyEvaluator;
    const guard = new Guard(evaluator);

    await expect(
      guard.canActivate(
        mockContext({
          [AUTH_CONTEXT_REQUEST_KEY]: {
            userId: 'u1',
            tenantId: 'tenant-session',
            tokenType: 'bearer',
          },
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 'tenant-header' },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      details: { reason: 'SESSION_TENANT_MISMATCH' },
    } satisfies Partial<AppError>);
    expect(requireAny).not.toHaveBeenCalled();
  });

  it('allows when any required permission is present and tenants match', async () => {
    const Guard = RequirePermission('tenant.manage', 'tenant.read');
    const evaluator = new PolicyEvaluator(
      new MapPermissionSource(new Map([['u1::t1', new Set(['tenant.read'])]])),
    );
    const guard = new Guard(evaluator);
    await expect(
      guard.canActivate(
        mockContext({
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1', tenantId: 't1', tokenType: 'bearer' },
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 't1' },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('evaluates permissions against session tenant id', async () => {
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
          [AUTH_CONTEXT_REQUEST_KEY]: { userId: 'u1', tenantId: 't1', tokenType: 'bearer' },
          [TENANT_CONTEXT_REQUEST_KEY]: { tenantId: 't1' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<AppError>);
    expect(requireAny).toHaveBeenCalledWith('u1', 't1', ['role.manage']);
  });
});
