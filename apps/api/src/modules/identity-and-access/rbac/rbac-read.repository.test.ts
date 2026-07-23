import { describe, expect, it, vi } from 'vitest';

import { RbacReadRepository } from './rbac-read.repository.js';

describe('RbacReadRepository', () => {
  const userId = '01900000-0000-7000-8000-000000000001';
  const tenantId = '01900000-0000-7000-8000-0000000000aa';

  it('returns empty without a pool', async () => {
    const repo = new RbacReadRepository(null);
    await expect(repo.listRolesForUser(userId, tenantId)).resolves.toEqual([]);
  });

  it('returns empty for invalid ids without querying', async () => {
    const query = vi.fn();
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const pool = { connect } as never;
    const repo = new RbacReadRepository(pool);
    await expect(repo.listRolesForUser('not-a-uuid', tenantId)).resolves.toEqual([]);
    expect(connect).not.toHaveBeenCalled();
  });

  it('SQL requires active membership via DEFINER helper (membership gate)', async () => {
    // withTenantTransaction issues BEGIN/GUC/COMMIT queries; only assert the roles SELECT.
    const query = vi.fn().mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('user_roles')) {
        expect(sql).toMatch(/user_has_active_membership/i);
        expect(sql).not.toMatch(/tenant_memberships/i);
        return Promise.resolve({
          rows: [{ code: 'staff', name: 'Staff', is_system: true }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const client = {
      query,
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    };
    const repo = new RbacReadRepository(pool as never);
    const roles = await repo.listRolesForUser(userId, tenantId);
    expect(roles).toEqual([{ code: 'staff', name: 'Staff', isSystem: true }]);
    expect(
      query.mock.calls.some(
        (args) => typeof args[0] === 'string' && String(args[0]).includes('user_roles'),
      ),
    ).toBe(true);
  });

  it('fails closed on DB errors and warns when logger is provided', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new RbacReadRepository({ connect } as never, logger);
    await expect(repo.listRolesForUser(userId, tenantId)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });
});
