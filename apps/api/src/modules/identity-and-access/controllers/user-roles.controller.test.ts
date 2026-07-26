import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { UserRolesController } from './user-roles.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const roleId = '01900000-0000-7000-8000-0000000000b1';
const assignmentId = '01900000-0000-7000-8000-0000000000c1';
const request = {
  [AUTH_CONTEXT_REQUEST_KEY]: { userId },
  [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
};

describe('UserRolesController', () => {
  it('forwards list filters and assign payload', async () => {
    const service = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 25 } }),
      assignForTenant: vi.fn().mockResolvedValue({ data: { id: assignmentId } }),
    };
    const controller = new UserRolesController(service as never);
    await controller.list(request as never, '25', assignmentId, userId);
    await controller.assign(request as never, { userId, roleId }, 'idem-user-role-controller');
    expect(service.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '25',
      cursor: assignmentId,
      userId,
    });
    expect(service.assignForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { userId, roleId },
      'idem-user-role-controller',
      'unknown',
    );
  });

  it('forwards delete and preserves a 204-compatible void result', async () => {
    const service = { unassignForTenant: vi.fn().mockResolvedValue(undefined) };
    const controller = new UserRolesController(service as never);
    await expect(
      controller.unassign(request as never, assignmentId, undefined),
    ).resolves.toBeUndefined();
    expect(service.unassignForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      assignmentId,
      undefined,
      'unknown',
    );
  });

  it('rejects missing auth context', async () => {
    const controller = new UserRolesController({ listForTenant: vi.fn() } as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
