import { describe, expect, it, vi } from 'vitest';

import { ClassesRepository } from './classes.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';
const classId = '01900000-0000-7000-8000-0000000000e1';

const emptyFilters = {
  limit: 25,
  cursor: undefined,
  academicYearId: undefined,
  termId: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('ClassesRepository', () => {
  it('returns empty page without pool', async () => {
    const repo = new ClassesRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('scopes SQL to tenant and orders by name', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM classes');
      expect(sql).toContain('c.tenant_id = $1::uuid');
      expect(sql).toContain('ORDER BY c.name ASC, c.id ASC');
      return Promise.resolve({
        rows: [
          {
            id: classId,
            tenant_id: tenantId,
            academic_year_id: yearId,
            term_id: null,
            name: 'Form 1A',
            code: 'F1A',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new ClassesRepository({ connect } as never);
    const result = await repo.listForTenant(actorId, tenantId, emptyFilters);
    expect(result.rows[0]).toMatchObject({ id: classId, name: 'Form 1A', termId: null });
  });
});
