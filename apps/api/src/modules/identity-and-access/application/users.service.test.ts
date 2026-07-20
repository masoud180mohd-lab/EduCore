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
      search: 'a\\%b\\_c',
    });
  });
});
