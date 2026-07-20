import { describe, expect, it, vi } from 'vitest';

import { AcademicYearsRepository } from './academic-years.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';

const emptyFilters = {
  limit: 25,
  cursor: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('AcademicYearsRepository', () => {
  it('returns empty page without a pool', async () => {
    const repo = new AcademicYearsRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns empty page for non-uuid actor without querying', async () => {
    const connect = vi.fn();
    const repo = new AcademicYearsRepository({ connect } as never);
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
    const repo = new AcademicYearsRepository({ connect } as never, logger);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('scopes SQL to tenant, orders by starts_on DESC, maps dates', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM academic_years');
      expect(sql).toContain('y.tenant_id = $1::uuid');
      expect(sql).toContain('ORDER BY y.starts_on DESC NULLS LAST, y.id ASC');
      return Promise.resolve({
        rows: [
          {
            id: yearId,
            tenant_id: tenantId,
            name: '2026/2027',
            code: '2026-27',
            starts_on: '2026-01-15',
            ends_on: '2026-12-15',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new AcademicYearsRepository({ connect } as never);
    const result = await repo.listForTenant(actorId, tenantId, emptyFilters);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      id: yearId,
      tenantId,
      name: '2026/2027',
      code: '2026-27',
      startsOn: '2026-01-15',
      endsOn: '2026-12-15',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns empty page for non-uuid cursor without querying', async () => {
    const connect = vi.fn();
    const repo = new AcademicYearsRepository({ connect } as never);
    await expect(
      repo.listForTenant(actorId, tenantId, { ...emptyFilters, cursor: 'not-a-uuid' }),
    ).resolves.toEqual({ rows: [], nextCursor: null });
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns null for getById without a pool', async () => {
    const repo = new AcademicYearsRepository(null);
    await expect(repo.getByIdForTenant(actorId, tenantId, yearId)).resolves.toBeNull();
  });

  it('returns null for getById with non-uuid ids without querying', async () => {
    const connect = vi.fn();
    const repo = new AcademicYearsRepository({ connect } as never);
    await expect(repo.getByIdForTenant('bad', tenantId, yearId)).resolves.toBeNull();
    await expect(repo.getByIdForTenant(actorId, tenantId, 'not-a-uuid')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('maps getById row when found and scopes to bound tenant', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM academic_years');
      expect(sql).toContain('y.tenant_id = $1::uuid');
      expect(sql).toContain('y.id = $2::uuid');
      return Promise.resolve({
        rows: [
          {
            id: yearId,
            tenant_id: tenantId,
            name: '2026/2027',
            code: null,
            starts_on: null,
            ends_on: null,
            status: 'draft',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new AcademicYearsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, yearId)).resolves.toMatchObject({
      id: yearId,
      tenantId,
      name: '2026/2027',
      status: 'draft',
    });
  });
});
