import { describe, expect, it, vi } from 'vitest';

import { MembershipsRepository } from './memberships.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('MembershipsRepository', () => {
  it('returns empty page without a pool', async () => {
    const repo = new MembershipsRepository(null);
    await expect(
      repo.listForTenant(userId, tenantId, { limit: 25, cursor: undefined, status: undefined }),
    ).resolves.toEqual({ rows: [], nextCursor: null });
  });

  it('returns empty page for non-uuid ids', async () => {
    const connect = vi.fn();
    const repo = new MembershipsRepository({ connect } as never);
    await expect(
      repo.listForTenant('bad', tenantId, { limit: 25, cursor: undefined, status: undefined }),
    ).resolves.toEqual({ rows: [], nextCursor: null });
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new MembershipsRepository({ connect } as never, logger);
    await expect(
      repo.listForTenant(userId, tenantId, { limit: 25, cursor: undefined, status: undefined }),
    ).resolves.toEqual({ rows: [], nextCursor: null });
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
      limit: 1,
      cursor: undefined,
      status: undefined,
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
});
