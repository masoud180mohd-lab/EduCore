import { describe, expect, it, vi } from 'vitest';

import { UsersRepository } from './users.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const userId = '01900000-0000-7000-8000-0000000000c1';

const emptyFilters = {
  limit: 25,
  cursor: undefined,
  status: undefined,
  membershipStatuses: ['active'] as const,
  search: undefined,
};

describe('UsersRepository', () => {
  it('returns empty page without a pool', async () => {
    const repo = new UsersRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns empty page for non-uuid actor', async () => {
    const connect = vi.fn();
    const repo = new UsersRepository({ connect } as never);
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
    const repo = new UsersRepository({ connect } as never, logger);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('maps rows, never exposes password, and sets nextCursor when page full', async () => {
    const rowA = {
      id: userId,
      email: 'a@example.com',
      display_name: 'Alice',
      status: 'active',
      email_verified_at: new Date('2026-01-01T00:00:00.000Z'),
      last_login_at: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const rowB = { ...rowA, id: '01900000-0000-7000-8000-0000000000c2', display_name: 'Bob' };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('tenant_memberships');
      expect(sql).toContain('m.status = ANY($2::text[])');
      expect(sql.toLowerCase()).not.toContain('password_hash');
      return Promise.resolve({ rows: [rowA, rowB] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    const result = await repo.listForTenant(actorId, tenantId, {
      ...emptyFilters,
      limit: 1,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBe(userId);
  });

  it('scopes cursor subquery to bound tenant membership', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    await repo.listForTenant(actorId, tenantId, {
      ...emptyFilters,
      cursor: userId,
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('FROM users'),
    );
    const sql = String(dataCall?.[0] ?? '');
    expect(sql).toContain('m2.tenant_id = $1::uuid');
    expect(sql).toContain('m2.status = ANY($2::text[])');
  });

  it('applies invited membership filter when requested', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    await repo.listForTenant(actorId, tenantId, {
      ...emptyFilters,
      membershipStatuses: ['invited'],
      status: 'invited',
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('FROM users'),
    );
    expect(dataCall?.[1]).toEqual([tenantId, ['invited'], 26, 'invited']);
  });

  it('returns null for getById without a pool', async () => {
    const repo = new UsersRepository(null);
    await expect(repo.getByIdForTenant(actorId, tenantId, userId, ['active'])).resolves.toBeNull();
  });

  it('returns null for getById with non-uuid ids without querying', async () => {
    const connect = vi.fn();
    const repo = new UsersRepository({ connect } as never);
    await expect(repo.getByIdForTenant('bad', tenantId, userId, ['active'])).resolves.toBeNull();
    await expect(
      repo.getByIdForTenant(actorId, tenantId, 'not-a-uuid', ['active']),
    ).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('maps getById row when found and scopes to tenant membership', async () => {
    const rowA = {
      id: userId,
      email: 'a@example.com',
      display_name: 'Alice',
      status: 'active',
      email_verified_at: null,
      last_login_at: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('tenant_memberships');
      expect(sql).toContain('m.tenant_id = $1::uuid');
      expect(sql).toContain('m.status = ANY($2::text[])');
      expect(sql).toContain('u.id = $3::uuid');
      expect(sql.toLowerCase()).not.toContain('password_hash');
      return Promise.resolve({ rows: [rowA] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    await expect(
      repo.getByIdForTenant(actorId, tenantId, userId, ['active']),
    ).resolves.toMatchObject({
      id: userId,
      email: 'a@example.com',
      displayName: 'Alice',
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('FROM users'),
    );
    expect(dataCall?.[1]).toEqual([tenantId, ['active'], userId]);
  });

  it('returns null for getById when no membership row (cross-tenant isolation)', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, userId, ['active'])).resolves.toBeNull();
  });

  it('fails closed on getById DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new UsersRepository({ connect } as never, logger);
    await expect(repo.getByIdForTenant(actorId, tenantId, userId, ['active'])).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });
});
