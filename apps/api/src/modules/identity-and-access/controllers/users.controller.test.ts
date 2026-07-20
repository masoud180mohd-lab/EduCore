import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { UsersController } from './users.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('UsersController', () => {
  it('lists users for authenticated principal with tenant context', async () => {
    const usersService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 'u1', email: 'a@x.com', displayName: 'A', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(usersService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 'u1', email: 'a@x.com', displayName: 'A', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards pagination and filter query params', async () => {
    const usersService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never, '10', 'cursor-id', 'active', 'alice');
    expect(usersService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: 'cursor-id',
      status: 'active',
      search: 'alice',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const usersService = { listForTenant: vi.fn() };
    const controller = new UsersController(usersService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(usersService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const usersService = { listForTenant: vi.fn() };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(usersService.listForTenant).not.toHaveBeenCalled();
  });

  it('documents read-only surface (no write methods on controller)', () => {
    // Structure: controller must not register write methods.
    const proto = UsersController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['list']).toBe('function');
    expect(proto['create']).toBeUndefined();
    expect(proto['update']).toBeUndefined();
    expect(proto['remove']).toBeUndefined();
  });
});
