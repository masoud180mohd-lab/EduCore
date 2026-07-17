import { describe, expect, it, vi } from 'vitest';

import { OrganizationsService } from './organizations.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const orgA = {
  id: '01900000-0000-7000-8000-0000000000a1',
  tenantId,
  orgType: 'school',
  name: 'Alpha School',
  code: 'alpha',
  status: 'active',
  parentOrganizationId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('OrganizationsService.listForTenant', () => {
  it('returns paginated organizations from repository', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [orgA], nextCursor: null }),
    };
    const service = new OrganizationsService(organizations as never);
    const result = await service.listForTenant(userId, tenantId, {});
    expect(result).toEqual({
      data: [orgA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(organizations.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const organizations = {
      isAvailable: () => false,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.listForTenant(userId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(organizations.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects invalid status filter', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.listForTenant(userId, tenantId, { status: 'archived' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('passes status and pagination to repository', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new OrganizationsService(organizations as never);
    await service.listForTenant(userId, tenantId, {
      limit: '10',
      cursor: orgA.id,
      status: 'active',
    });
    expect(organizations.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 10,
      cursor: orgA.id,
      status: 'active',
    });
  });
});
