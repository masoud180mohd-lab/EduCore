import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { OrganizationsController } from './organizations.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('OrganizationsController', () => {
  it('lists organizations for authenticated principal with tenant context', async () => {
    const organizationsService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 'o1', name: 'School A', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(organizationsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 'o1', name: 'School A', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards query params', async () => {
    const organizationsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never, '10', 'cursor-id', 'active');
    expect(organizationsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: 'cursor-id',
      status: 'active',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const organizationsService = { listForTenant: vi.fn() };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(organizationsService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const organizationsService = { listForTenant: vi.fn() };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(organizationsService.listForTenant).not.toHaveBeenCalled();
  });

  it('gets organization by id for bound tenant', async () => {
    const orgId = '01900000-0000-7000-8000-0000000000a1';
    const organizationsService = {
      getForTenant: vi.fn().mockResolvedValue({
        data: { id: orgId, name: 'School A', status: 'active' },
      }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getById(request as never, orgId);
    expect(organizationsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, orgId);
    expect(result).toEqual({
      data: { id: orgId, name: 'School A', status: 'active' },
    });
  });

  it('rejects getById when auth context is missing', async () => {
    const organizationsService = { getForTenant: vi.fn() };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000a1'),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(organizationsService.getForTenant).not.toHaveBeenCalled();
  });

  it('rejects getById when tenant context is missing', async () => {
    const organizationsService = { getForTenant: vi.fn() };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(
      controller.getById(request as never, '01900000-0000-7000-8000-0000000000a1'),
    ).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(organizationsService.getForTenant).not.toHaveBeenCalled();
  });
});
