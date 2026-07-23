import { describe, expect, it } from 'vitest';

import { PERMISSION_CODES } from '../../../common/policy/permission-codes.js';
import {
  reconcileSystemRoleGrantsForTenant,
  type ReconcileQueryable,
} from './system-role-grant-reconcile.js';
import { permissionsForSystemRole } from './system-roles.js';

describe('reconcileSystemRoleGrantsForTenant', () => {
  it('deletes grants outside the matrix and inserts missing codes', async () => {
    const roleIds = {
      owner: 'r-owner',
      admin: 'r-admin',
      staff: 'r-staff',
      parent: 'r-parent',
    };
    const deleteCalls: Array<{ roleId: string; allowed: string[] }> = [];
    const insertCodes: string[] = [];

    const client: ReconcileQueryable = {
      query: (sql: string, params?: ReadonlyArray<unknown>) => {
        if (sql.includes('SELECT id FROM roles')) {
          const code = params?.[1] as keyof typeof roleIds;
          return Promise.resolve({ rows: [{ id: roleIds[code] }] });
        }
        if (sql.includes('DELETE FROM role_permissions')) {
          deleteCalls.push({
            roleId: String(params?.[0]),
            allowed: params?.[1] as string[],
          });
          return Promise.resolve({ rows: [{ code: 'stale.permission' }] });
        }
        if (sql.includes('INSERT INTO role_permissions')) {
          insertCodes.push(String(params?.[1]));
          if (params?.[0] === roleIds.staff && params[1] === 'tenant.read') {
            return Promise.resolve({ rows: [{ code: 'tenant.read' }] });
          }
          return Promise.resolve({ rows: [] });
        }
        return Promise.reject(new Error(`unexpected SQL: ${sql}`));
      },
    };

    const result = await reconcileSystemRoleGrantsForTenant(client, { tenantId: 't1' });

    expect(result.tenantId).toBe('t1');
    expect(result.roles.map((r) => r.code)).toEqual(['owner', 'admin', 'staff', 'parent']);
    expect(deleteCalls).toHaveLength(4);
    expect(deleteCalls[0]?.allowed).toEqual([...PERMISSION_CODES]);
    expect(deleteCalls[1]?.allowed).toEqual([...permissionsForSystemRole('admin')]);
    expect(deleteCalls[2]?.allowed).toEqual([...permissionsForSystemRole('staff')]);
    expect(deleteCalls[3]?.allowed).toEqual([...permissionsForSystemRole('parent')]);
    expect(result.roles[0]?.removedCodes).toEqual(['stale.permission']);
    expect(insertCodes).toContain('tenant.read');
    expect(insertCodes).toContain('entitlement.manage');
  });

  it('throws when a system role row is missing', async () => {
    const client: ReconcileQueryable = {
      query: () => Promise.resolve({ rows: [] }),
    };
    await expect(
      reconcileSystemRoleGrantsForTenant(client, { tenantId: 't-missing' }),
    ).rejects.toThrow(/system role owner missing/);
  });
});
