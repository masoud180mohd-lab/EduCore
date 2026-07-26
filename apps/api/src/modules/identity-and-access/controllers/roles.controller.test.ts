import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { RolesController } from './roles.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const roleId = '01900000-0000-7000-8000-0000000000b1';
const request = {
  [AUTH_CONTEXT_REQUEST_KEY]: { userId },
  [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
};

describe('RolesController', () => {
  it('forwards list and get requests', async () => {
    const service = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
      getForTenant: vi.fn().mockResolvedValue({ data: { id: roleId } }),
    };
    const controller = new RolesController(service as never);
    await controller.list(request as never, '10', roleId);
    await controller.getById(request as never, roleId);
    expect(service.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: roleId,
    });
    expect(service.getForTenant).toHaveBeenCalledWith(userId, tenantId, roleId);
  });

  it('forwards create, rename, and permission replacement', async () => {
    const service = {
      createForTenant: vi.fn().mockResolvedValue({ data: { id: roleId } }),
      renameForTenant: vi.fn().mockResolvedValue({ data: { id: roleId } }),
      replacePermissionsForTenant: vi.fn().mockResolvedValue({ data: { id: roleId } }),
    };
    const controller = new RolesController(service as never);
    await controller.create(
      request as never,
      { code: 'teachers', name: 'Teachers' },
      'idem-role-1',
    );
    await controller.rename(request as never, roleId, { name: 'Staff' }, undefined);
    await controller.replacePermissions(
      request as never,
      roleId,
      { permissionCodes: ['user.read'] },
      undefined,
    );
    expect(service.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { code: 'teachers', name: 'Teachers' },
      'idem-role-1',
      'unknown',
    );
    expect(service.renameForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      roleId,
      { name: 'Staff' },
      undefined,
      'unknown',
    );
    expect(service.replacePermissionsForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      roleId,
      { permissionCodes: ['user.read'] },
      undefined,
      'unknown',
    );
  });

  it('rejects missing tenant context', async () => {
    const controller = new RolesController({ listForTenant: vi.fn() } as never);
    await expect(
      controller.list({ [AUTH_CONTEXT_REQUEST_KEY]: { userId } } as never),
    ).rejects.toMatchObject({ code: 'TENANT_CONTEXT_REQUIRED' });
  });
});
