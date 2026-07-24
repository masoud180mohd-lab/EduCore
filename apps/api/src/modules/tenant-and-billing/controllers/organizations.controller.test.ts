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
      orgType: undefined,
      search: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 'o1', name: 'School A', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards pagination and filter query params', async () => {
    const organizationsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const cursorId = '01900000-0000-7000-8000-0000000000a1';
    await controller.list(request as never, '10', cursorId, 'active', 'school', 'campus');
    expect(organizationsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: cursorId,
      status: 'active',
      orgType: 'school',
      search: 'campus',
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

  it('creates organization for bound tenant', async () => {
    const organizationsService = {
      createForTenant: vi.fn().mockResolvedValue({
        data: { id: 'o1', name: 'School A', status: 'active' },
      }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const body = { orgType: 'school', name: 'School A' };
    const result = await controller.create(request as never, body, 'idem-key-abcdefghijkl');
    expect(organizationsService.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      body,
      'idem-key-abcdefghijkl',
      'unknown',
    );
    expect(result).toEqual({ data: { id: 'o1', name: 'School A', status: 'active' } });
  });

  it('patches organization for bound tenant', async () => {
    const orgId = '01900000-0000-7000-8000-0000000000a1';
    const organizationsService = {
      patchForTenant: vi.fn().mockResolvedValue({
        data: { id: orgId, name: 'Renamed', status: 'active' },
      }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const body = { name: 'Renamed' };
    const result = await controller.patch(request as never, orgId, body, 'idem-patch-key-01');
    expect(organizationsService.patchForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      orgId,
      body,
      'idem-patch-key-01',
      'unknown',
    );
    expect(result).toEqual({ data: { id: orgId, name: 'Renamed', status: 'active' } });
  });

  it('deactivates organization for bound tenant', async () => {
    const orgId = '01900000-0000-7000-8000-0000000000a1';
    const organizationsService = {
      deactivateForTenant: vi.fn().mockResolvedValue({
        data: { id: orgId, name: 'School A', status: 'inactive' },
      }),
    };
    const controller = new OrganizationsController(organizationsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.deactivate(request as never, orgId, undefined);
    expect(organizationsService.deactivateForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      orgId,
      undefined,
      'unknown',
    );
    expect(result).toEqual({ data: { id: orgId, name: 'School A', status: 'inactive' } });
  });

  it('documents list + create + get + patch + deactivate (no delete)', () => {
    const proto = OrganizationsController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['list']).toBe('function');
    expect(typeof proto['create']).toBe('function');
    expect(typeof proto['getById']).toBe('function');
    expect(typeof proto['patch']).toBe('function');
    expect(typeof proto['deactivate']).toBe('function');
    expect(proto['remove']).toBeUndefined();
    expect(proto['delete']).toBeUndefined();
  });
});
