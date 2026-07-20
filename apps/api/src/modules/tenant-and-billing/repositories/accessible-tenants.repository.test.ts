import { describe, expect, it, vi } from 'vitest';

import {
  ACCESSIBLE_TENANTS_LIST_CAP,
  AccessibleTenantsRepository,
} from './accessible-tenants.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

function tenantRow(idSuffix: string, code: string) {
  return {
    id: `01900000-0000-7000-8000-0000000000${idSuffix}`,
    code,
    name: code,
    status: 'active',
    primary_locale: 'en',
    timezone: 'Africa/Dar_es_Salaam',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('AccessibleTenantsRepository', () => {
  it('returns empty list without a pool', async () => {
    const repo = new AccessibleTenantsRepository(null);
    await expect(repo.listAccessibleTenants(userId)).resolves.toEqual([]);
  });

  it('returns null for get without a pool', async () => {
    const repo = new AccessibleTenantsRepository(null);
    await expect(repo.getAccessibleTenantById(userId, tenantId)).resolves.toBeNull();
  });

  it('fails closed on list DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new AccessibleTenantsRepository({ connect } as never, logger);
    await expect(repo.listAccessibleTenants(userId)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('fails closed on get DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new AccessibleTenantsRepository({ connect } as never, logger);
    await expect(repo.getAccessibleTenantById(userId, tenantId)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('applies soft safety LIMIT and truncates with warn when over cap', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const overflow = Array.from({ length: ACCESSIBLE_TENANTS_LIST_CAP + 1 }, (_, i) =>
      tenantRow(
        String(100 + i)
          .padStart(2, '0')
          .slice(-2),
        `t-${String(i).padStart(3, '0')}`,
      ),
    );
    // Use stable unique ids without colliding hex — build uuid from index.
    const rows = overflow.map((row, i) => ({
      ...row,
      id: `01900000-0000-7000-8000-${String(i).padStart(12, '0')}`,
    }));

    const query = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('LIMIT $1');
      expect(params).toEqual([ACCESSIBLE_TENANTS_LIST_CAP + 1]);
      return Promise.resolve({ rows });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new AccessibleTenantsRepository({ connect } as never, logger);
    const result = await repo.listAccessibleTenants(userId);
    expect(result).toHaveLength(ACCESSIBLE_TENANTS_LIST_CAP);
    expect(warn).toHaveBeenCalledWith(
      'AccessibleTenantsRepository.listAccessibleTenants truncated',
      expect.objectContaining({ cap: ACCESSIBLE_TENANTS_LIST_CAP }),
    );
  });
});
