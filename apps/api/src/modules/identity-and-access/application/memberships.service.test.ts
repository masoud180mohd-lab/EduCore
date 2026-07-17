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

  it('passes status and pagination to repository', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new MembershipsService(memberships as never);
    await service.listForTenant(userId, tenantId, {
      limit: '10',
      cursor: membershipA.id,
      status: 'active',
    });
    expect(memberships.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 10,
      cursor: membershipA.id,
      status: 'active',
    });
  });
});
