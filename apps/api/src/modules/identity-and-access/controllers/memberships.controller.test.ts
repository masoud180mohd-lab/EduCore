import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { MembershipsController } from './memberships.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('MembershipsController', () => {
  it('lists memberships for authenticated principal with tenant context', async () => {
    const membershipsService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 'm1', userId, status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(membershipsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 'm1', userId, status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards query params', async () => {
    const membershipsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never, '10', 'cursor-id', 'active');
    expect(membershipsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: 'cursor-id',
      status: 'active',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const membershipsService = { listForTenant: vi.fn() };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(membershipsService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const membershipsService = { listForTenant: vi.fn() };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(membershipsService.listForTenant).not.toHaveBeenCalled();
  });

  it('gets membership by id for bound tenant', async () => {
    const membershipId = '01900000-0000-7000-8000-0000000000b1';
    const membershipsService = {
      getForTenant: vi.fn().mockResolvedValue({
        data: { id: membershipId, userId, status: 'active' },
      }),
    };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getById(request as never, membershipId);
    expect(membershipsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, membershipId);
    expect(result).toEqual({
      data: { id: membershipId, userId, status: 'active' },
    });
  });

  it('rejects getById when auth context is missing', async () => {
    const membershipsService = { getForTenant: vi.fn() };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000b1'),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(membershipsService.getForTenant).not.toHaveBeenCalled();
  });

  it('rejects getById when tenant context is missing', async () => {
    const membershipsService = { getForTenant: vi.fn() };
    const controller = new MembershipsController(membershipsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000b1'),
    ).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(membershipsService.getForTenant).not.toHaveBeenCalled();
  });
});
