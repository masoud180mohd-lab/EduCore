import { describe, expect, it, vi } from 'vitest';

import { TenantsService } from './tenants.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantA = {
  id: '01900000-0000-7000-8000-0000000000aa',
  code: 'demo-school',
  name: 'Demo School',
  status: 'active',
  primaryLocale: 'en',
  timezone: 'Africa/Dar_es_Salaam',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('TenantsService.listForUser', () => {
  it('returns tenants from repository when pool is available', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      listAccessibleTenants: vi.fn().mockResolvedValue([tenantA]),
    };
    const service = new TenantsService(accessibleTenants as never);
    const result = await service.listForUser(userId);
    expect(result.data).toEqual([tenantA]);
    expect(accessibleTenants.listAccessibleTenants).toHaveBeenCalledWith(userId);
  });

  it('returns empty list when user has no accessible tenants', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      listAccessibleTenants: vi.fn().mockResolvedValue([]),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.listForUser(userId)).resolves.toEqual({ data: [] });
  });

  it('returns empty list when app pool is disabled (CI fail-closed)', async () => {
    const accessibleTenants = {
      isAvailable: () => false,
      listAccessibleTenants: vi.fn(),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.listForUser(userId)).resolves.toEqual({ data: [] });
    expect(accessibleTenants.listAccessibleTenants).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      listAccessibleTenants: vi.fn(),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.listForUser('not-a-uuid')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('TenantsService.getForUser', () => {
  it('returns tenant when membership-visible', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      getAccessibleTenantById: vi.fn().mockResolvedValue(tenantA),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.getForUser(userId, tenantA.id)).resolves.toEqual({ data: tenantA });
    expect(accessibleTenants.getAccessibleTenantById).toHaveBeenCalledWith(userId, tenantA.id);
  });

  it('returns NOT_FOUND when repository yields null (no membership or missing)', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      getAccessibleTenantById: vi.fn().mockResolvedValue(null),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.getForUser(userId, tenantA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('returns NOT_FOUND for invalid tenant id shape (no enumeration)', async () => {
    const accessibleTenants = {
      isAvailable: () => true,
      getAccessibleTenantById: vi.fn(),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.getForUser(userId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(accessibleTenants.getAccessibleTenantById).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when pool is unavailable', async () => {
    const accessibleTenants = {
      isAvailable: () => false,
      getAccessibleTenantById: vi.fn(),
    };
    const service = new TenantsService(accessibleTenants as never);
    await expect(service.getForUser(userId, tenantA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(accessibleTenants.getAccessibleTenantById).not.toHaveBeenCalled();
  });
});
