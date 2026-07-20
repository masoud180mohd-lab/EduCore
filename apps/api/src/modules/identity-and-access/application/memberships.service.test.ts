import { describe, expect, it, vi } from 'vitest';

import { MembershipsService } from './memberships.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const membershipA = {
  id: '01900000-0000-7000-8000-0000000000b1',
  tenantId,
  userId,
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('MembershipsService.getForTenant', () => {
  it('returns membership when visible in bound tenant', async () => {
    const memberships = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(membershipA),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.getForTenant(userId, tenantId, membershipA.id)).resolves.toEqual({
      data: membershipA,
    });
    expect(memberships.getByIdForTenant).toHaveBeenCalledWith(userId, tenantId, membershipA.id);
  });

  it('returns NOT_FOUND when repository yields null', async () => {
    const memberships = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.getForTenant(userId, tenantId, membershipA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('returns NOT_FOUND for invalid membership id shape (no enumeration)', async () => {
    const memberships = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.getForTenant(userId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(memberships.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when pool is unavailable', async () => {
    const memberships = {
      isAvailable: () => false,
      getByIdForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.getForTenant(userId, tenantId, membershipA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(memberships.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const memberships = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.getForTenant('bad', tenantId, membershipA.id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('MembershipsService.listForTenant', () => {
  it('returns paginated memberships from repository', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [membershipA], nextCursor: null }),
    };
    const service = new MembershipsService(memberships as never);
    const result = await service.listForTenant(userId, tenantId, {});
    expect(result).toEqual({
      data: [membershipA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(memberships.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
      userId: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const memberships = {
      isAvailable: () => false,
      listForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.listForTenant(userId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(memberships.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects invalid status filter', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(
      service.listForTenant(userId, tenantId, { status: 'deleted' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects invalid userId filter', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(
      service.listForTenant(userId, tenantId, { userId: 'not-a-uuid' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('passes status, userId, and pagination to repository', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: membershipA.id }),
    };
    const service = new MembershipsService(memberships as never);
    const result = await service.listForTenant(userId, tenantId, {
      limit: '10',
      cursor: membershipA.id,
      status: 'active',
      userId: userId,
    });
    expect(result.page).toEqual({ nextCursor: membershipA.id, limit: 10 });
    expect(memberships.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 10,
      cursor: membershipA.id,
      status: 'active',
      userId,
    });
  });
});
