import { describe, expect, it, vi } from 'vitest';

import { SubjectsRepository } from './subjects.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const subjectId = '01900000-0000-7000-8000-0000000000a1';
const empty = {
  limit: 25,
  cursor: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('SubjectsRepository', () => {
  it('returns empty page without pool', async () => {
    const repo = new SubjectsRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, empty)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('maps list row and scopes tenant', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM subjects');
      expect(sql).toContain('s.tenant_id = $1::uuid');
      return Promise.resolve({
        rows: [
          {
            id: subjectId,
            tenant_id: tenantId,
            name: 'Math',
            code: 'MTH',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const repo = new SubjectsRepository({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    } as never);
    const result = await repo.listForTenant(actorId, tenantId, empty);
    expect(result.rows[0]).toMatchObject({ id: subjectId, name: 'Math', code: 'MTH' });
  });
});
