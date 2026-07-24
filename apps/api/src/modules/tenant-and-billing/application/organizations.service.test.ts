import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

describe('OrganizationsService.createForTenant', () => {
  const corr = 'corr-org-1';

  it('requires Idempotency-Key', async () => {
    const organizations = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.createForTenant(userId, tenantId, { orgType: 'school', name: 'N' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('creates organization and audits success', async () => {
    const organizations = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(orgA),
    };
    const audit = new InMemoryAuditPublisher();
    const store = new InMemoryIdempotencyStore();
    const service = new OrganizationsService(organizations as never, store, audit);
    const key = 'idem-key-org-create-000001';
    await expect(
      service.createForTenant(
        userId,
        tenantId,
        { orgType: 'school', name: 'Alpha School', code: 'alpha' },
        key,
        corr,
      ),
    ).resolves.toEqual({ data: orgA });
    expect(organizations.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      expect.objectContaining({
        orgType: 'school',
        name: 'Alpha School',
        code: 'alpha',
      }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'organization.create',
      outcome: 'success',
      resourceId: orgA.id,
    });
  });

  it('replays identical idempotent create', async () => {
    const organizations = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(orgA),
    };
    const store = new InMemoryIdempotencyStore();
    const service = new OrganizationsService(organizations as never, store);
    const key = 'idem-key-org-create-000002';
    const body = { orgType: 'school' as const, name: 'Alpha School' };
    const first = await service.createForTenant(userId, tenantId, body, key, corr);
    const second = await service.createForTenant(userId, tenantId, body, key, corr);
    expect(first).toEqual(second);
    expect(organizations.createForTenant).toHaveBeenCalledOnce();
  });

  it('maps unique violation to CONFLICT', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    const organizations = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue(err),
    };
    const service = new OrganizationsService(
      organizations as never,
      new InMemoryIdempotencyStore(),
    );
    await expect(
      service.createForTenant(
        userId,
        tenantId,
        { orgType: 'school', name: 'X', code: 'dup' },
        'idem-key-org-create-000003',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects invalid orgType', async () => {
    const organizations = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.createForTenant(
        userId,
        tenantId,
        { orgType: 'faculty', name: 'X' },
        'idem-key-org-create-000004',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('OrganizationsService.patchForTenant', () => {
  const corr = 'corr-org-patch';

  it('patches name and audits', async () => {
    const updated = { ...orgA, name: 'Renamed School' };
    const organizations = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new OrganizationsService(organizations as never, null, audit);
    await expect(
      service.patchForTenant(
        userId,
        tenantId,
        orgA.id,
        { name: 'Renamed School' },
        undefined,
        corr,
      ),
    ).resolves.toEqual({ data: updated });
    expect(organizations.updateForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      orgA.id,
      expect.objectContaining({ setName: true, name: 'Renamed School' }),
    );
    expect(audit.events[0]).toMatchObject({ action: 'organization.patch', outcome: 'success' });
  });

  it('rejects empty patch body', async () => {
    const organizations = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.patchForTenant(userId, tenantId, orgA.id, {}, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps unique violation to CONFLICT', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    const organizations = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockRejectedValue(err),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.patchForTenant(userId, tenantId, orgA.id, { code: 'dup' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('returns 404 when org missing', async () => {
    const organizations = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.patchForTenant(userId, tenantId, orgA.id, { name: 'X' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('OrganizationsService.deactivateForTenant', () => {
  const corr = 'corr-org-deact';

  it('deactivates and audits', async () => {
    const inactive = { ...orgA, status: 'inactive' };
    const organizations = {
      isAvailable: () => true,
      deactivateForTenant: vi.fn().mockResolvedValue(inactive),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new OrganizationsService(organizations as never, null, audit);
    await expect(
      service.deactivateForTenant(userId, tenantId, orgA.id, undefined, corr),
    ).resolves.toEqual({ data: inactive });
    expect(audit.events[0]).toMatchObject({
      action: 'organization.deactivate',
      outcome: 'success',
    });
  });

  it('returns 404 when org missing', async () => {
    const organizations = {
      isAvailable: () => true,
      deactivateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new OrganizationsService(organizations as never);
    await expect(
      service.deactivateForTenant(userId, tenantId, orgA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
