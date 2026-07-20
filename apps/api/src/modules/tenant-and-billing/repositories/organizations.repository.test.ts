import { describe, expect, it, vi } from 'vitest';

import { OrganizationsRepository } from './organizations.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('OrganizationsRepository', () => {
  const emptyFilters = {
    limit: 25,
    cursor: undefined,
    status: undefined,
    search: undefined,
    orgType: undefined,
  } as const;

  it('returns empty page without a pool', async () => {
    const repo = new OrganizationsRepository(null);
    await expect(repo.listForTenant(userId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns empty page for non-uuid ids', async () => {
    const connect = vi.fn();
    const repo = new OrganizationsRepository({ connect } as never);
    await expect(repo.listForTenant('not-uuid', tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new OrganizationsRepository({ connect } as never, logger);
    await expect(repo.listForTenant(userId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('maps rows and nextCursor when page is full', async () => {
    const orgA = {
      id: '01900000-0000-7000-8000-0000000000a1',
      tenant_id: tenantId,
      org_type: 'school',
      name: 'Alpha',
      code: 'alpha',
      status: 'active',
      parent_organization_id: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const orgB = {
      ...orgA,
      id: '01900000-0000-7000-8000-0000000000a2',
      name: 'Beta',
      code: 'beta',
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [orgA, orgB] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new OrganizationsRepository({ connect } as never);
    const result = await repo.listForTenant(userId, tenantId, {
      ...emptyFilters,
      limit: 1,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: orgA.id,
      tenantId,
      orgType: 'school',
      name: 'Alpha',
      code: 'alpha',
      status: 'active',
      parentOrganizationId: null,
    });
    expect(result.nextCursor).toBe(orgA.id);
  });

  it('applies status, orgType, and search filters in SQL params', async () => {
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
    const repo = new OrganizationsRepository({ connect } as never);
    await repo.listForTenant(userId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: 'active',
      orgType: 'campus',
      search: 'demo',
    });
    const dataCall = query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === 'string' && String(call[0]).includes('FROM organizations'),
    );
    expect(dataCall).toBeDefined();
    const sql = String(dataCall?.[0] ?? '');
    const params = dataCall?.[1] as unknown[];
    expect(sql).toContain('o.status');
    expect(sql).toContain('o.org_type');
    expect(sql).toContain('ILIKE');
    expect(params).toEqual([tenantId, 26, 'active', 'campus', 'demo']);
  });

  it('returns null for getById without a pool', async () => {
    const repo = new OrganizationsRepository(null);
    await expect(
      repo.getByIdForTenant(userId, tenantId, '01900000-0000-7000-8000-0000000000a1'),
    ).resolves.toBeNull();
  });

  it('returns null for getById with invalid organization id', async () => {
    const connect = vi.fn();
    const repo = new OrganizationsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(userId, tenantId, 'bad')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on getById DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new OrganizationsRepository({ connect } as never, logger);
    await expect(
      repo.getByIdForTenant(userId, tenantId, '01900000-0000-7000-8000-0000000000a1'),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('maps getById row when found', async () => {
    const orgA = {
      id: '01900000-0000-7000-8000-0000000000a1',
      tenant_id: tenantId,
      org_type: 'school',
      name: 'Alpha',
      code: 'alpha',
      status: 'active',
      parent_organization_id: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
    };
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [orgA] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new OrganizationsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(userId, tenantId, orgA.id)).resolves.toMatchObject({
      id: orgA.id,
      tenantId,
      name: 'Alpha',
      orgType: 'school',
    });
  });
});
