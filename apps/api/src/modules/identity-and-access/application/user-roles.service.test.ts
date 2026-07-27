import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { UserRolesService } from './user-roles.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const targetId = '01900000-0000-7000-8000-000000000002';
const roleId = '01900000-0000-7000-8000-0000000000b1';
const assignmentId = '01900000-0000-7000-8000-0000000000c1';
const assignment = {
  id: assignmentId,
  tenantId,
  userId: targetId,
  roleId,
  organizationId: null,
  roleCode: 'teachers',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UserRolesService', () => {
  it('lists assignments filtered by user', async () => {
    const repository = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [assignment], nextCursor: null }),
    };
    const service = new UserRolesService(repository as never);
    await service.listForTenant(actorId, tenantId, { userId: targetId });
    expect(repository.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      userId: targetId,
    });
  });

  it('requires idempotency and accepts optional organizationId on assign', async () => {
    const repository = {
      isAvailable: () => true,
      assignForTenant: vi.fn().mockResolvedValue(assignment),
    };
    const service = new UserRolesService(repository as never);
    await expect(
      service.assignForTenant(
        actorId,
        tenantId,
        { userId: targetId, roleId, organizationId: null },
        undefined,
        'c1',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    await service.assignForTenant(
      actorId,
      tenantId,
      { userId: targetId, roleId, organizationId: tenantId },
      'idem-user-role-0001',
      'c1',
    );
    expect(repository.assignForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      userRoleId: expect.any(String) as string,
      userId: targetId,
      roleId,
      organizationId: tenantId,
    });
  });

  it('returns 409 for duplicate assignment', async () => {
    const repository = {
      isAvailable: () => true,
      assignForTenant: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' })),
    };
    const service = new UserRolesService(repository as never);
    await expect(
      service.assignForTenant(
        actorId,
        tenantId,
        { userId: targetId, roleId, organizationId: null },
        'idem-user-role-0002',
        'c1',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('unassigns once and replays an optional idempotency key', async () => {
    const repository = {
      isAvailable: () => true,
      unassignForTenant: vi.fn().mockResolvedValue(true),
    };
    const service = new UserRolesService(repository as never, new InMemoryIdempotencyStore());
    const key = 'idem-user-role-delete01';
    await service.unassignForTenant(actorId, tenantId, assignmentId, key, 'c1');
    await service.unassignForTenant(actorId, tenantId, assignmentId, key, 'c1');
    expect(repository.unassignForTenant).toHaveBeenCalledOnce();
  });
});
