import { describe, expect, it, vi } from 'vitest';

import { StreamsRepository } from './streams.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const streamId = '01900000-0000-7000-8000-0000000000f1';
const classId = '01900000-0000-7000-8000-0000000000e1';
const empty = {
  limit: 25,
  cursor: undefined,
  classId: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('StreamsRepository', () => {
  it('returns empty page without pool', async () => {
    const repo = new StreamsRepository(null);
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
      expect(sql).toContain('FROM streams');
      expect(sql).toContain('s.tenant_id = $1::uuid');
      return Promise.resolve({
        rows: [
          {
            id: streamId,
            tenant_id: tenantId,
            class_id: classId,
            name: 'A',
            code: 'A',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const repo = new StreamsRepository({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    } as never);
    const result = await repo.listForTenant(actorId, tenantId, empty);
    expect(result.rows[0]).toMatchObject({ id: streamId, classId, name: 'A' });
  });

  it('getById returns null for bad uuid', async () => {
    const connect = vi.fn();
    const repo = new StreamsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, 'x')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });
});
