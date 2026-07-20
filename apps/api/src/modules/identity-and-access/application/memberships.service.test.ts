import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

  it('rejects invalid cursor uuid', async () => {
    const memberships = {
      isAvailable: () => true,
      listForTenant: vi.fn(),
    };
    const service = new MembershipsService(memberships as never);
    await expect(
      service.listForTenant(userId, tenantId, { cursor: 'bad-cursor' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(memberships.listForTenant).not.toHaveBeenCalled();
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

describe('MembershipsService.inviteForTenant', () => {
  const corr = 'corr-invite-1';
  const invited = {
    ...membershipA,
    id: '01900000-0000-7000-8000-0000000000b9',
    status: 'invited',
    joinedAt: null,
  };

  it('requires Idempotency-Key', async () => {
    const memberships = { isAvailable: () => true, inviteForTenant: vi.fn() };
    const service = new MembershipsService(memberships as never);
    await expect(
      service.inviteForTenant(userId, tenantId, { email: 'a@example.com' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(memberships.inviteForTenant).not.toHaveBeenCalled();
  });

  it('creates invite and audits success', async () => {
    const memberships = {
      isAvailable: () => true,
      inviteForTenant: vi.fn().mockResolvedValue(invited),
    };
    const audit = new InMemoryAuditPublisher();
    const store = new InMemoryIdempotencyStore();
    const service = new MembershipsService(memberships as never, store, audit);
    const key = 'idem-key-membership-invite01';
    await expect(
      service.inviteForTenant(
        userId,
        tenantId,
        { email: 'teacher@example.com', displayName: 'Asha', roleCodes: ['staff'] },
        key,
        corr,
      ),
    ).resolves.toEqual({ data: invited });
    expect(memberships.inviteForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      expect.objectContaining({
        email: 'teacher@example.com',
        displayName: 'Asha',
        roleCodes: ['staff'],
      }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'membership.invite',
      outcome: 'success',
      resourceId: invited.id,
    });
  });

  it('replays identical idempotent invite without re-writing', async () => {
    const memberships = {
      isAvailable: () => true,
      inviteForTenant: vi.fn().mockResolvedValue(invited),
    };
    const store = new InMemoryIdempotencyStore();
    const service = new MembershipsService(memberships as never, store);
    const key = 'idem-key-membership-invite02';
    const body = { email: 'b@example.com' };
    const first = await service.inviteForTenant(userId, tenantId, body, key, corr);
    const second = await service.inviteForTenant(userId, tenantId, body, key, corr);
    expect(first).toEqual(second);
    expect(memberships.inviteForTenant).toHaveBeenCalledOnce();
  });

  it('conflicts when idempotency key reused with different body', async () => {
    const memberships = {
      isAvailable: () => true,
      inviteForTenant: vi.fn().mockResolvedValue(invited),
    };
    const store = new InMemoryIdempotencyStore();
    const service = new MembershipsService(memberships as never, store);
    const key = 'idem-key-membership-invite03';
    await service.inviteForTenant(userId, tenantId, { email: 'c@example.com' }, key, corr);
    await expect(
      service.inviteForTenant(userId, tenantId, { email: 'd@example.com' }, key, corr),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSE_MISMATCH' });
  });

  it('maps unique violation to CONFLICT', async () => {
    const err = Object.assign(new Error('duplicate'), { code: '23505' });
    const memberships = {
      isAvailable: () => true,
      inviteForTenant: vi.fn().mockRejectedValue(err),
    };
    const service = new MembershipsService(memberships as never, new InMemoryIdempotencyStore());
    await expect(
      service.inviteForTenant(
        userId,
        tenantId,
        { email: 'e@example.com' },
        'idem-key-membership-invite04',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects invalid email', async () => {
    const memberships = { isAvailable: () => true, inviteForTenant: vi.fn() };
    const service = new MembershipsService(memberships as never);
    await expect(
      service.inviteForTenant(
        userId,
        tenantId,
        { email: 'not-an-email' },
        'idem-key-membership-invite05',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
