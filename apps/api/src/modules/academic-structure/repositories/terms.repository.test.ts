import { describe, expect, it, vi } from 'vitest';

import { TermsRepository } from './terms.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';
const termId = '01900000-0000-7000-8000-0000000000d1';

const emptyFilters = {
  limit: 25,
  cursor: undefined,
  academicYearId: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('TermsRepository', () => {
  it('returns empty page without a pool', async () => {
    const repo = new TermsRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns null for getById without a pool', async () => {
    const repo = new TermsRepository(null);
    await expect(repo.getByIdForTenant(actorId, tenantId, termId)).resolves.toBeNull();
  });

  it('returns null for getById with non-uuid ids without querying', async () => {
    const connect = vi.fn();
    const repo = new TermsRepository({ connect } as never);
    await expect(repo.getByIdForTenant('bad', tenantId, termId)).resolves.toBeNull();
    await expect(repo.getByIdForTenant(actorId, tenantId, 'not-a-uuid')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('maps getById row when found and scopes to bound tenant', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM terms');
      expect(sql).toContain('t.tenant_id = $1::uuid');
      expect(sql).toContain('t.id = $2::uuid');
      return Promise.resolve({
        rows: [
          {
            id: termId,
            tenant_id: tenantId,
            academic_year_id: yearId,
            name: 'Term 1',
            code: 'T1',
            starts_on: '2026-01-15',
            ends_on: '2026-04-15',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new TermsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, termId)).resolves.toEqual({
      id: termId,
      tenantId,
      academicYearId: yearId,
      name: 'Term 1',
      code: 'T1',
      startsOn: '2026-01-15',
      endsOn: '2026-04-15',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('fails closed on getById DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new TermsRepository({ connect } as never, logger);
    await expect(repo.getByIdForTenant(actorId, tenantId, termId)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('createForTenant calls app.create_term with parent year and maps row', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('app.create_term');
      return Promise.resolve({
        rows: [
          {
            id: termId,
            tenant_id: tenantId,
            academic_year_id: yearId,
            name: 'Term 1',
            code: 'T1',
            starts_on: '2026-01-15',
            ends_on: '2026-04-15',
            status: 'draft',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new TermsRepository({ connect } as never);
    await expect(
      repo.createForTenant(actorId, tenantId, {
        id: termId,
        academicYearId: yearId,
        name: 'Term 1',
        code: 'T1',
        startsOn: '2026-01-15',
        endsOn: '2026-04-15',
        status: 'draft',
      }),
    ).resolves.toMatchObject({
      id: termId,
      academicYearId: yearId,
      name: 'Term 1',
      status: 'draft',
    });
  });
});
