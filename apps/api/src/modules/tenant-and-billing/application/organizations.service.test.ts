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

describe('OrganizationsService.getForTenant', () => {
  it('returns organization when visible in bound tenant', async () => {
    const organizations = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(orgA),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.getForTenant(userId, tenantId, orgA.id)).resolves.toEqual({
      data: orgA,
    });
    expect(organizations.getByIdForTenant).toHaveBeenCalledWith(userId, tenantId, orgA.id);
  });

  it('returns NOT_FOUND when repository yields null', async () => {
    const organizations = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.getForTenant(userId, tenantId, orgA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('returns NOT_FOUND for invalid organization id shape (no enumeration)', async () => {
    const organizations = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.getForTenant(userId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(organizations.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when pool is unavailable', async () => {
    const organizations = {
      isAvailable: () => false,
      getByIdForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.getForTenant(userId, tenantId, orgA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(organizations.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const organizations = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(service.getForTenant('bad', tenantId, orgA.id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

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
      search: undefined,
      orgType: undefined,
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

  it('rejects invalid cursor uuid', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.listForTenant(userId, tenantId, { cursor: 'bad-cursor' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(organizations.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid orgType filter', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.listForTenant(userId, tenantId, { orgType: 'district' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects search that is too long', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.listForTenant(userId, tenantId, { search: 'x'.repeat(101) }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('passes pagination, status, orgType, and escaped search to repository', async () => {
    const organizations = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [orgA], nextCursor: orgA.id }),
    };
    const service = new OrganizationsService(organizations as never);
    const result = await service.listForTenant(userId, tenantId, {
      limit: '10',
      cursor: orgA.id,
      status: 'active',
      orgType: 'school',
      search: 'a%b_c',
    });
    expect(result.page).toEqual({ nextCursor: orgA.id, limit: 10 });
    expect(organizations.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: 10,
      cursor: orgA.id,
      status: 'active',
      orgType: 'school',
      search: 'a\\%b\\_c',
    });
  });
});
