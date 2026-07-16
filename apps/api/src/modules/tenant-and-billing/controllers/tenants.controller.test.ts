import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { TenantsController } from './tenants.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('TenantsController', () => {
  it('lists tenants for authenticated principal', async () => {
    const tenantsService = {
      listForUser: vi.fn().mockResolvedValue({
        data: [{ id: 't1', code: 'a', name: 'A', status: 'active' }],
      }),
    };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    const result = await controller.list(request as never);
    expect(tenantsService.listForUser).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      data: [{ id: 't1', code: 'a', name: 'A', status: 'active' }],
    });
  });

  it('rejects list when auth context is missing', async () => {
    const tenantsService = { listForUser: vi.fn() };
    const controller = new TenantsController(tenantsService as never);
    await expect(controller.list({} as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(tenantsService.listForUser).not.toHaveBeenCalled();
  });

  it('gets current tenant from X-Tenant-Id context', async () => {
    const tenantsService = {
      getForUser: vi.fn().mockResolvedValue({
        data: { id: tenantId, code: 'demo', name: 'Demo', status: 'active' },
      }),
    };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getCurrent(request as never);
    expect(tenantsService.getForUser).toHaveBeenCalledWith(userId, tenantId);
    expect(result).toEqual({
      data: { id: tenantId, code: 'demo', name: 'Demo', status: 'active' },
    });
  });

  it('rejects getCurrent without tenant context', async () => {
    const tenantsService = { getForUser: vi.fn() };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.getCurrent(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(tenantsService.getForUser).not.toHaveBeenCalled();
  });

  it('rejects getCurrent without auth context', async () => {
    const tenantsService = { getForUser: vi.fn() };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.getCurrent(request as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(tenantsService.getForUser).not.toHaveBeenCalled();
  });

  it('gets tenant by id when path matches X-Tenant-Id', async () => {
    const tenantsService = {
      getForUser: vi.fn().mockResolvedValue({
        data: { id: tenantId, code: 'demo', name: 'Demo', status: 'active' },
      }),
    };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getById(request as never, tenantId);
    expect(tenantsService.getForUser).toHaveBeenCalledWith(userId, tenantId);
    expect(result).toEqual({
      data: { id: tenantId, code: 'demo', name: 'Demo', status: 'active' },
    });
  });

  it('forbids getById when path tenant differs from X-Tenant-Id', async () => {
    const other = '01900000-0000-7000-8000-0000000000bb';
    const tenantsService = { getForUser: vi.fn() };
    const controller = new TenantsController(tenantsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.getById(request as never, other)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'TENANT_PATH_MISMATCH' },
    });
    expect(tenantsService.getForUser).not.toHaveBeenCalled();
  });

  it('rejects getById when auth context is missing', async () => {
    const tenantsService = { getForUser: vi.fn() };
    const controller = new TenantsController(tenantsService as never);
    await expect(controller.getById({} as never, tenantId)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(tenantsService.getForUser).not.toHaveBeenCalled();
  });
});
