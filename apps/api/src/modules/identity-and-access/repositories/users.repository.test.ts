import { describe, expect, it, vi } from 'vitest';

import { UsersRepository } from './users.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const emptyFilters = {
  limit: 25,
  cursor: undefined,
  status: undefined,
  search: undefined,
} as const;

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
      id: '01900000-0000-7000-8000-0000000000c1',
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
      expect(sql).toContain("m.status = 'active'");
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
    expect(result.rows[0]).toEqual({
      id: rowA.id,
      email: 'a@example.com',
      displayName: 'Alice',
      status: 'active',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(result.nextCursor).toBe(rowA.id);
  });

  it('applies status and search filters in SQL params (tenant-scoped)', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new UsersRepository({ connect } as never);
    await repo.listForTenant(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: 'active',
      search: 'demo',
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && String(call[0]).includes('FROM users'),
    );
    expect(dataCall).toBeDefined();
    const sql = String(dataCall?.[0] ?? '');
    const params = dataCall?.[1] as unknown[];
    expect(sql).toContain('m.tenant_id = $1');
    expect(sql).toContain('u.status');
    expect(sql).toContain('ILIKE');
    expect(params).toEqual([tenantId, 26, 'active', 'demo']);
  });
});
