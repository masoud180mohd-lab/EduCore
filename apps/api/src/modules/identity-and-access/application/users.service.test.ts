import { describe, expect, it, vi } from 'vitest';

import { UsersService } from './users.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const userA = {
  id: '01900000-0000-7000-8000-0000000000c1',
  email: 'a@example.com',
  displayName: 'Alice',
  status: 'active',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersService.listForTenant', () => {
  it('returns paginated users from repository', async () => {
    const users = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [userA], nextCursor: null }),
    };
    const service = new UsersService(users as never);
    const result = await service.listForTenant(actorId, tenantId, {});
    expect(result).toEqual({
      data: [userA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(users.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
      membershipStatuses: ['active'],
      search: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const users = {
      isAvailable: () => false,
      listForTenant: vi.fn(),
    };
    const service = new UsersService(users as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(users.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid actor', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new UsersService(users as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects invalid status filter', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new UsersService(users as never);
    await expect(
      service.listForTenant(actorId, tenantId, { status: 'suspended' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects search that is too long', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new UsersService(users as never);
    await expect(
      service.listForTenant(actorId, tenantId, { search: 'x'.repeat(101) }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('passes pagination, status, and escaped search to repository', async () => {
    const users = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [userA], nextCursor: userA.id }),
    };
    const service = new UsersService(users as never);
    const result = await service.listForTenant(actorId, tenantId, {
      limit: '10',
      cursor: userA.id,
      status: 'active',
      search: 'a%b_c',
    });
    expect(result.page).toEqual({ nextCursor: userA.id, limit: 10 });
    expect(users.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 10,
      cursor: userA.id,
      status: 'active',
      membershipStatuses: ['active'],
      search: 'a\\%b\\_c',
    });
  });

  it('rejects invalid cursor uuid', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new UsersService(users as never);
    await expect(
      service.listForTenant(actorId, tenantId, { cursor: 'not-a-uuid' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(users.listForTenant).not.toHaveBeenCalled();
  });

  it('uses invited membership filter when status=invited (ACF Q5)', async () => {
    const users = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new UsersService(users as never);
    await service.listForTenant(actorId, tenantId, { status: 'invited' });
    expect(users.listForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      expect.objectContaining({
        status: 'invited',
        membershipStatuses: ['invited'],
      }),
    );
  });
});

describe('UsersService.getForTenant', () => {
  it('returns user envelope when repository finds row', async () => {
    const users = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(userA),
    };
    const service = new UsersService(users as never);
    await expect(service.getForTenant(actorId, tenantId, userA.id)).resolves.toEqual({
      data: userA,
    });
    expect(users.getByIdForTenant).toHaveBeenCalledWith(actorId, tenantId, userA.id, ['active']);
  });

  it('returns 404 when user not visible', async () => {
    const users = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new UsersService(users as never);
    await expect(service.getForTenant(actorId, tenantId, userA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
