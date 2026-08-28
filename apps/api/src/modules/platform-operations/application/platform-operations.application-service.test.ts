import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { PlatformOperationsApplicationService } from './platform-operations.application-service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const school = {
  id: tenantId,
  code: 'demo-school',
  name: 'Demo School',
  status: 'active',
  primaryLocale: 'en',
  timezone: 'Africa/Dar_es_Salaam',
  planCode: 'starter',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  entitlements: [],
};

function service(tenants: object, idempotency = new InMemoryIdempotencyStore()) {
  return new PlatformOperationsApplicationService(tenants as never, idempotency);
}

describe('PlatformOperationsApplicationService', () => {
  it('lists tenants when the store is available', async () => {
    const tenants = {
      isAvailable: () => true,
      listTenants: vi.fn().mockResolvedValue({ rows: [school], nextCursor: null }),
    };
    const result = await service(tenants).listTenants(actorId, {});
    expect(result.data).toHaveLength(1);
    expect(result.page.nextCursor).toBeNull();
    expect(tenants.listTenants).toHaveBeenCalledWith(actorId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
    });
  });

  it('returns empty list when the store is unavailable', async () => {
    const tenants = { isAvailable: () => false, listTenants: vi.fn() };
    await expect(service(tenants).listTenants(actorId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(tenants.listTenants).not.toHaveBeenCalled();
  });

  it('registers a tenant with idempotency replay', async () => {
    const tenants = {
      isAvailable: () => true,
      registerTenant: vi
        .fn()
        .mockResolvedValue({ tenant: school, ownerUserId: actorId, ownerCreated: true }),
    };
    const idempotency = new InMemoryIdempotencyStore();
    const svc = service(tenants, idempotency);
    const body = {
      code: 'demo-school',
      name: 'Demo School',
      primaryLocale: 'en',
      timezone: 'Africa/Dar_es_Salaam',
      owner: { email: 'owner@school.tz', displayName: 'Owner' },
    };
    const first = await svc.registerTenant(actorId, body, 'idempotency-key-1', 'corr-1');
    const second = await svc.registerTenant(actorId, body, 'idempotency-key-1', 'corr-1');
    expect(first).toEqual({ data: school });
    expect(second).toEqual(first);
    expect(tenants.registerTenant).toHaveBeenCalledTimes(1);
  });

  it('requires Idempotency-Key on register', async () => {
    const tenants = { isAvailable: () => true, registerTenant: vi.fn() };
    await expect(
      service(tenants).registerTenant(actorId, {}, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('maps duplicate tenant code to CONFLICT', async () => {
    const tenants = {
      isAvailable: () => true,
      registerTenant: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' })),
    };
    await expect(
      service(tenants).registerTenant(
        actorId,
        {
          code: 'demo-school',
          name: 'Demo School',
          primaryLocale: 'en',
          timezone: 'Africa/Dar_es_Salaam',
          owner: { email: 'owner@school.tz', displayName: 'Owner' },
        },
        'idempotency-key-2',
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects invalid status transitions', async () => {
    const tenants = {
      isAvailable: () => true,
      setTenantStatus: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('bad'), { code: 'INVALID_STATUS', currentStatus: 'closed' }),
        ),
    };
    await expect(
      service(tenants).suspendTenant(actorId, tenantId, { reason: 'Need a pause' }, 'corr'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects unknown entitlement codes', async () => {
    const tenants = { isAvailable: () => true, setEntitlement: vi.fn() };
    await expect(
      service(tenants).setEntitlement(
        actorId,
        tenantId,
        'hostel',
        { enabled: true, reason: 'Not allowed' },
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tenants.setEntitlement).not.toHaveBeenCalled();
  });
});
