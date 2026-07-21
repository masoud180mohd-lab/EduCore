import { describe, expect, it, vi } from 'vitest';

import { EnrollmentsRepository } from './enrollments.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const empty = {
  limit: 25,
  cursor: undefined,
  studentId: undefined,
  classId: undefined,
  academicYearId: undefined,
  streamId: undefined,
  status: undefined,
} as const;

describe('EnrollmentsRepository', () => {
  it('returns empty page without pool', async () => {
    const repo = new EnrollmentsRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, empty)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('scopes list SQL to tenant and orders by created_at', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM enrollments');
      expect(sql).toContain('e.tenant_id = $1::uuid');
      expect(sql).toContain('ORDER BY e.created_at ASC, e.id ASC');
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new EnrollmentsRepository({ connect } as never);
    await repo.listForTenant(actorId, tenantId, empty);
  });

  it('create calls app.create_enrollment', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('app.create_enrollment');
      return Promise.resolve({
        rows: [
          {
            id: '01900000-0000-7000-8000-0000000000a1',
            tenant_id: tenantId,
            student_id: '01900000-0000-7000-8000-0000000000b1',
            class_id: '01900000-0000-7000-8000-0000000000e1',
            stream_id: null,
            academic_year_id: '01900000-0000-7000-8000-0000000000c1',
            term_id: null,
            status: 'active',
            enrolled_at: new Date('2026-01-01T00:00:00.000Z'),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new EnrollmentsRepository({ connect } as never);
    await expect(
      repo.createForTenant(actorId, tenantId, {
        id: '01900000-0000-7000-8000-0000000000a1',
        studentId: '01900000-0000-7000-8000-0000000000b1',
        classId: '01900000-0000-7000-8000-0000000000e1',
        streamId: null,
        status: 'active',
      }),
    ).resolves.toMatchObject({ status: 'active' });
  });
});
