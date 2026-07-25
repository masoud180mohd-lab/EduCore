import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

const policyAllowManage = {
  hasPermission: vi.fn().mockResolvedValue(true),
};
const policyDenyManage = {
  hasPermission: vi.fn().mockResolvedValue(false),
};

function makeService(
  users: unknown,
  policy: unknown = policyAllowManage,
  idempotency: unknown = null,
  audit: unknown = null,
): UsersService {
  return new UsersService(users as never, policy as never, idempotency as never, audit as never);
}

describe('UsersService.listForTenant', () => {
  it('returns paginated users from repository', async () => {
    const users = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [userA], nextCursor: null }),
    };
    const service = makeService(users);
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
    const service = makeService(users);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(users.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid actor', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = makeService(users);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects invalid status filter', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = makeService(users);
    await expect(
      service.listForTenant(actorId, tenantId, { status: 'suspended' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects search that is too long', async () => {
    const users = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = makeService(users);
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
    const service = makeService(users);
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
    const service = makeService(users);
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
    const service = makeService(users);
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
    const service = makeService(users);
    await expect(service.getForTenant(actorId, tenantId, userA.id)).resolves.toEqual({
      data: userA,
    });
    expect(users.getByIdForTenant).toHaveBeenCalledWith(actorId, tenantId, userA.id, ['active']);
  });

  it('returns 404 when user not visible (missing or cross-tenant)', async () => {
    const users = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(users);
    await expect(service.getForTenant(actorId, tenantId, userA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 for well-formed UUID that repository cannot see', async () => {
    const unknownId = '01900000-0000-7000-8000-00000000dead';
    const users = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(users);
    await expect(service.getForTenant(actorId, tenantId, unknownId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(users.getByIdForTenant).toHaveBeenCalledWith(actorId, tenantId, unknownId, ['active']);
  });

  it('returns 404 for invalid target UUID without calling repository', async () => {
    const users = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = makeService(users);
    await expect(service.getForTenant(actorId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(users.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('returns 404 when pool unavailable (no existence leak)', async () => {
    const users = {
      isAvailable: () => false,
      getByIdForTenant: vi.fn(),
    };
    const service = makeService(users);
    await expect(service.getForTenant(actorId, tenantId, userA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(users.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid actor', async () => {
    const users = { isAvailable: () => true, getByIdForTenant: vi.fn() };
    const service = makeService(users);
    await expect(service.getForTenant('bad', tenantId, userA.id)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('UsersService.patchForTenant', () => {
  const corr = 'corr-user-1';
  const updated = { ...userA, displayName: 'Alice Updated' };

  it('allows self patch without user.manage', async () => {
    const users = {
      isAvailable: () => true,
      updateDisplayNameForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = makeService(users, policyDenyManage, null, audit);
    await expect(
      service.patchForTenant(
        userA.id,
        tenantId,
        userA.id,
        { displayName: 'Alice Updated' },
        undefined,
        corr,
      ),
    ).resolves.toEqual({ data: updated });
    expect(policyDenyManage.hasPermission).not.toHaveBeenCalled();
    expect(audit.events[0]).toMatchObject({ action: 'user.patch', outcome: 'success' });
  });

  it('allows manage patch of other user', async () => {
    const users = {
      isAvailable: () => true,
      updateDisplayNameForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = makeService(users, policyAllowManage);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        userA.id,
        { displayName: 'Alice Updated' },
        undefined,
        corr,
      ),
    ).resolves.toEqual({ data: updated });
    expect(policyAllowManage.hasPermission).toHaveBeenCalledWith(actorId, tenantId, 'user.manage');
  });

  it('forbids other user without user.manage', async () => {
    const users = { isAvailable: () => true, updateDisplayNameForTenant: vi.fn() };
    const service = makeService(users, policyDenyManage);
    await expect(
      service.patchForTenant(actorId, tenantId, userA.id, { displayName: 'X' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(users.updateDisplayNameForTenant).not.toHaveBeenCalled();
  });

  it('rejects status field on PATCH', async () => {
    const users = { isAvailable: () => true, updateDisplayNameForTenant: vi.fn() };
    const service = makeService(users);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        userA.id,
        { displayName: 'X', status: 'disabled' },
        undefined,
        corr,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns 404 when target not visible', async () => {
    const users = {
      isAvailable: () => true,
      updateDisplayNameForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(users);
    await expect(
      service.patchForTenant(actorId, tenantId, userA.id, { displayName: 'X' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('replays optional idempotency key', async () => {
    const users = {
      isAvailable: () => true,
      updateDisplayNameForTenant: vi.fn().mockResolvedValue(updated),
    };
    const store = new InMemoryIdempotencyStore();
    const service = makeService(users, policyAllowManage, store);
    const key = 'idem-key-user-patch-000001';
    const body = { displayName: 'Alice Updated' };
    const first = await service.patchForTenant(actorId, tenantId, userA.id, body, key, corr);
    const second = await service.patchForTenant(actorId, tenantId, userA.id, body, key, corr);
    expect(first).toEqual(second);
    expect(users.updateDisplayNameForTenant).toHaveBeenCalledOnce();
  });
});

describe('UsersService.disableForTenant', () => {
  const corr = 'corr-user-disable';

  it('disables other user with user.manage', async () => {
    const disabled = { ...userA, status: 'disabled' };
    const users = {
      isAvailable: () => true,
      disableForTenant: vi.fn().mockResolvedValue(disabled),
    };
    const audit = new InMemoryAuditPublisher();
    const service = makeService(users, policyAllowManage, null, audit);
    await expect(
      service.disableForTenant(actorId, tenantId, userA.id, undefined, corr),
    ).resolves.toEqual({ data: disabled });
    expect(policyAllowManage.hasPermission).toHaveBeenCalledWith(actorId, tenantId, 'user.manage');
    expect(audit.events[0]).toMatchObject({ action: 'user.disable', outcome: 'success' });
  });

  it('rejects self-disable', async () => {
    const users = { isAvailable: () => true, disableForTenant: vi.fn() };
    const service = makeService(users, policyAllowManage);
    await expect(
      service.disableForTenant(userA.id, tenantId, userA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(users.disableForTenant).not.toHaveBeenCalled();
  });

  it('forbids without user.manage', async () => {
    const users = { isAvailable: () => true, disableForTenant: vi.fn() };
    const service = makeService(users, policyDenyManage);
    await expect(
      service.disableForTenant(actorId, tenantId, userA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns 404 when target not visible', async () => {
    const users = {
      isAvailable: () => true,
      disableForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(users, policyAllowManage);
    await expect(
      service.disableForTenant(actorId, tenantId, userA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('UsersService.enableForTenant', () => {
  const corr = 'corr-user-enable';

  it('enables disabled user with user.manage', async () => {
    const enabled = { ...userA, status: 'active' };
    const users = {
      isAvailable: () => true,
      enableForTenant: vi.fn().mockResolvedValue(enabled),
    };
    const audit = new InMemoryAuditPublisher();
    const service = makeService(users, policyAllowManage, null, audit);
    await expect(
      service.enableForTenant(actorId, tenantId, userA.id, undefined, corr),
    ).resolves.toEqual({ data: enabled });
    expect(audit.events[0]).toMatchObject({ action: 'user.enable', outcome: 'success' });
  });

  it('rejects self-enable', async () => {
    const users = { isAvailable: () => true, enableForTenant: vi.fn() };
    const service = makeService(users, policyAllowManage);
    await expect(
      service.enableForTenant(userA.id, tenantId, userA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(users.enableForTenant).not.toHaveBeenCalled();
  });

  it('returns 404 when target not visible or wrong status', async () => {
    const users = {
      isAvailable: () => true,
      enableForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = makeService(users, policyAllowManage);
    await expect(
      service.enableForTenant(actorId, tenantId, userA.id, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
