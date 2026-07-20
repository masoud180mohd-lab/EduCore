import { describe, expect, it, vi } from 'vitest';

import { MembershipsRepository } from './memberships.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('MembershipsRepository', () => {
  const emptyFilters = {
    limit: 25,
    cursor: undefined,
    status: undefined,
    userId: undefined,
  } as const;

  it('returns empty page without a pool', async () => {
    const repo = new MembershipsRepository(null);
    await expect(repo.listForTenant(userId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns empty page for non-uuid ids', async () => {
    const connect = vi.fn();
    const repo = new MembershipsRepository({ connect } as never);
    await expect(repo.listForTenant('bad', tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new MembershipsRepository({ connect } as never, logger);
    await expect(repo.listForTenant(userId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('maps rows and nextCursor when page is full', async () => {
    const rowA = {
      id: '01900000-0000-7000-8000-0000000000b1',
      tenant_id: tenantId,
      user_id: userId,
      status: 'active',
      joined_at: new Date('2026-01-01T00:00:00.000Z'),
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const rowB = {
      ...rowA,
      id: '01900000-0000-7000-8000-0000000000b2',
      user_id: '01900000-0000-7000-8000-000000000002',
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [rowA, rowB] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new MembershipsRepository({ connect } as never);
    const result = await repo.listForTenant(userId, tenantId, {
      ...emptyFilters,
      limit: 1,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: rowA.id,
      tenantId,
      userId,
      status: 'active',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.nextCursor).toBe(rowA.id);
  });

  it('applies status and userId filters in SQL params', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new MembershipsRepository({ connect } as never);
    await repo.listForTenant(userId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: 'active',
      userId,
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && String(call[0]).includes('FROM tenant_memberships'),
    );
    expect(dataCall).toBeDefined();
    const sql = String(dataCall?.[0] ?? '');
    const params = dataCall?.[1] as unknown[];
    expect(sql).toContain('m.status');
    expect(sql).toContain('m.user_id');
    expect(params).toEqual([tenantId, 26, 'active', userId]);
  });

  it('returns null for getById without a pool', async () => {
    const repo = new MembershipsRepository(null);
    await expect(
      repo.getByIdForTenant(userId, tenantId, '01900000-0000-7000-8000-0000000000b1'),
    ).resolves.toBeNull();
  });

  it('returns null for getById with invalid membership id', async () => {
    const connect = vi.fn();
    const repo = new MembershipsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(userId, tenantId, 'bad')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on getById DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new MembershipsRepository({ connect } as never, logger);
    await expect(
      repo.getByIdForTenant(userId, tenantId, '01900000-0000-7000-8000-0000000000b1'),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('maps getById row when found', async () => {
    const rowA = {
      id: '01900000-0000-7000-8000-0000000000b1',
      tenant_id: tenantId,
      user_id: userId,
      status: 'active',
      joined_at: new Date('2026-01-01T00:00:00.000Z'),
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [rowA] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new MembershipsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(userId, tenantId, rowA.id)).resolves.toMatchObject({
      id: rowA.id,
      tenantId,
      userId,
      status: 'active',
    });
  });

  it('inviteForTenant calls SECURITY DEFINER helper and maps row', async () => {
    const membershipId = '01900000-0000-7000-8000-0000000000b2';
    const newUserId = '01900000-0000-7000-8000-0000000000c9';
    const rowA = {
      id: membershipId,
      tenant_id: tenantId,
      user_id: newUserId,
      status: 'invited',
      joined_at: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      if (String(sql).includes('app.invite_tenant_membership')) {
        return Promise.resolve({ rows: [rowA] });
      }
      if (String(sql).includes('app.assign_system_role_codes')) {
        return Promise.resolve({ rows: [{ assign_system_role_codes: 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new MembershipsRepository({ connect } as never);
    await expect(
      repo.inviteForTenant(userId, tenantId, {
        membershipId,
        newUserId,
        email: 'teacher@example.com',
        displayName: 'Asha',
        roleCodes: ['staff'],
      }),
    ).resolves.toMatchObject({
      id: membershipId,
      status: 'invited',
      userId: newUserId,
    });
    expect(
      query.mock.calls.some((c) => String(c[0]).includes('app.invite_tenant_membership')),
    ).toBe(true);
    expect(
      query.mock.calls.some((c) => String(c[0]).includes('app.assign_system_role_codes')),
    ).toBe(true);
  });
});
