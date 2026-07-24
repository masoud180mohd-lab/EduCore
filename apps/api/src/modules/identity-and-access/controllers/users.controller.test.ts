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
    const cursorId = '01900000-0000-7000-8000-0000000000c1';
    await controller.list(request as never, '10', cursorId, 'active', 'alice');
    expect(usersService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: cursorId,
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

  it('documents read + patch + disable surface (no create/remove)', () => {
    const proto = UsersController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['list']).toBe('function');
    expect(typeof proto['getById']).toBe('function');
    expect(typeof proto['patch']).toBe('function');
    expect(typeof proto['disable']).toBe('function');
    expect(proto['create']).toBeUndefined();
    expect(proto['remove']).toBeUndefined();
  });

  it('gets user by id for bound tenant', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000c1';
    const usersService = {
      getForTenant: vi.fn().mockResolvedValue({
        data: { id: targetId, email: 'a@x.com', displayName: 'A', status: 'active' },
      }),
    };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getById(request as never, targetId);
    expect(usersService.getForTenant).toHaveBeenCalledWith(userId, tenantId, targetId);
    expect(result).toEqual({
      data: { id: targetId, email: 'a@x.com', displayName: 'A', status: 'active' },
    });
  });

  it('rejects getById when auth context is missing', async () => {
    const usersService = { getForTenant: vi.fn() };
    const controller = new UsersController(usersService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000c1'),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(usersService.getForTenant).not.toHaveBeenCalled();
  });

  it('rejects getById when tenant context is missing', async () => {
    const usersService = { getForTenant: vi.fn() };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000c1'),
    ).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(usersService.getForTenant).not.toHaveBeenCalled();
  });

  it('patches user displayName for bound tenant', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000c1';
    const usersService = {
      patchForTenant: vi.fn().mockResolvedValue({
        data: { id: targetId, displayName: 'New Name', status: 'active' },
      }),
    };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const body = { displayName: 'New Name' };
    const result = await controller.patch(request as never, targetId, body, undefined);
    expect(usersService.patchForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      targetId,
      body,
      undefined,
      'unknown',
    );
    expect(result).toEqual({
      data: { id: targetId, displayName: 'New Name', status: 'active' },
    });
  });

  it('disables user for bound tenant', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000c1';
    const usersService = {
      disableForTenant: vi.fn().mockResolvedValue({
        data: { id: targetId, email: 'a@x.com', displayName: 'A', status: 'disabled' },
      }),
    };
    const controller = new UsersController(usersService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.disable(request as never, targetId, undefined);
    expect(usersService.disableForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      targetId,
      undefined,
      'unknown',
    );
    expect(result).toEqual({
      data: { id: targetId, email: 'a@x.com', displayName: 'A', status: 'disabled' },
    });
  });

  it('documents list + getById + patch + disable (no create/remove)', () => {
    const proto = UsersController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['list']).toBe('function');
    expect(typeof proto['getById']).toBe('function');
    expect(typeof proto['patch']).toBe('function');
    expect(typeof proto['disable']).toBe('function');
    expect(proto['create']).toBeUndefined();
    expect(proto['remove']).toBeUndefined();
  });
});
