import { describe, expect, it, vi } from 'vitest';

import { StudentsRepository } from './students.repository.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const studentId = '01900000-0000-7000-8000-0000000000b1';

const emptyFilters = {
  limit: 25,
  cursor: undefined,
  status: undefined,
  search: undefined,
} as const;

describe('StudentsRepository', () => {
  it('returns empty page without a pool', async () => {
    const repo = new StudentsRepository(null);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
  });

  it('returns empty page for non-uuid actor', async () => {
    const connect = vi.fn();
    const repo = new StudentsRepository({ connect } as never);
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
    const repo = new StudentsRepository({ connect } as never, logger);
    await expect(repo.listForTenant(actorId, tenantId, emptyFilters)).resolves.toEqual({
      rows: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('scopes SQL to tenant and never selects secret fields', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('FROM students');
      expect(sql).toContain('s.tenant_id = $1::uuid');
      expect(sql.toLowerCase()).not.toContain('password');
      expect(sql.toLowerCase()).not.toContain('national');
      return Promise.resolve({
        rows: [
          {
            id: studentId,
            tenant_id: tenantId,
            student_code: 'STU-1',
            display_name: 'Asha',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new StudentsRepository({ connect } as never);
    const result = await repo.listForTenant(actorId, tenantId, emptyFilters);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: studentId,
      tenantId,
      displayName: 'Asha',
      studentCode: 'STU-1',
    });
    expect(result.rows[0]).not.toHaveProperty('passwordHash');
  });

  it('returns null for getById without a pool', async () => {
    const repo = new StudentsRepository(null);
    await expect(repo.getByIdForTenant(actorId, tenantId, studentId)).resolves.toBeNull();
  });

  it('returns null for getById with non-uuid ids without querying', async () => {
    const connect = vi.fn();
    const repo = new StudentsRepository({ connect } as never);
    await expect(repo.getByIdForTenant('bad', tenantId, studentId)).resolves.toBeNull();
    await expect(repo.getByIdForTenant(actorId, tenantId, 'not-a-uuid')).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('maps getById row when found and scopes to bound tenant', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('s.tenant_id = $1::uuid');
      expect(sql).toContain('s.id = $2::uuid');
      expect(sql.toLowerCase()).not.toContain('national');
      return Promise.resolve({
        rows: [
          {
            id: studentId,
            tenant_id: tenantId,
            student_code: 'STU-1',
            display_name: 'Asha',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new StudentsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, studentId)).resolves.toMatchObject({
      id: studentId,
      displayName: 'Asha',
      tenantId,
    });
  });

  it('returns null for getById when no row (cross-tenant isolation)', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new StudentsRepository({ connect } as never);
    await expect(repo.getByIdForTenant(actorId, tenantId, studentId)).resolves.toBeNull();
  });

  it('createForTenant calls SECURITY DEFINER helper and maps row', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('app.create_student');
      return Promise.resolve({
        rows: [
          {
            id: studentId,
            tenant_id: tenantId,
            student_code: 'STU-1',
            display_name: 'Asha',
            status: 'active',
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new StudentsRepository({ connect } as never);
    await expect(
      repo.createForTenant(actorId, tenantId, {
        id: studentId,
        studentCode: 'STU-1',
        displayName: 'Asha',
        status: 'active',
      }),
    ).resolves.toMatchObject({ id: studentId, displayName: 'Asha', status: 'active' });
  });
});
