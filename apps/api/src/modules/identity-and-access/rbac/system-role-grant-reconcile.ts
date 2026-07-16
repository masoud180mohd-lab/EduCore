/**
 * Reconcile system-role permission grants to the current TypeScript matrices (IMP-001 P4).
 *
 * Bootstrap (educore_platform) can only INSERT grants — DELETE is revoked by design.
 * This module issues DELETE + INSERT and MUST run under a privileged role
 * (educore_migrator / DATABASE_URL owner), never from the Nest educore_app pool.
 */
import { SYSTEM_ROLE_DEFINITIONS, type SystemRoleCode } from './system-roles.js';

export type ReconcileSystemRoleGrantsInput = {
  readonly tenantId: string;
};

export type ReconcileSystemRoleGrantsResult = {
  readonly tenantId: string;
  readonly roles: ReadonlyArray<{
    readonly code: SystemRoleCode;
    readonly roleId: string;
    readonly removedCodes: ReadonlyArray<string>;
    readonly addedCodes: ReadonlyArray<string>;
  }>;
};

/** Minimal query surface — pg.Client satisfies this; tests can stub it. */
export type ReconcileQueryable = {
  query: (
    sql: string,
    params?: ReadonlyArray<unknown>,
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

/**
 * For each system role on the tenant: remove grants not in the matrix, add missing ones.
 * Does not touch custom (non-system) roles.
 */
export async function reconcileSystemRoleGrantsForTenant(
  client: ReconcileQueryable,
  input: ReconcileSystemRoleGrantsInput,
): Promise<ReconcileSystemRoleGrantsResult> {
  const roles: Array<ReconcileSystemRoleGrantsResult['roles'][number]> = [];

  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    const resolved = await client.query(
      `SELECT id FROM roles
       WHERE tenant_id = $1::uuid AND code = $2 AND is_system = true
       LIMIT 1`,
      [input.tenantId, def.code],
    );
    const roleId = resolved.rows[0]?.['id'];
    if (typeof roleId !== 'string') {
      throw new Error(
        `system role ${def.code} missing for tenant ${input.tenantId}; run bootstrap first`,
      );
    }

    const allowed = [...def.permissions];
    const removed = await client.query(
      `DELETE FROM role_permissions rp
       USING permissions p
       WHERE rp.role_id = $1::uuid
         AND rp.permission_id = p.id
         AND NOT (p.code = ANY($2::text[]))
       RETURNING p.code`,
      [roleId, allowed],
    );

    const addedCodes: string[] = [];
    for (const permissionCode of def.permissions) {
      const inserted = await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at)
         SELECT $1::uuid, p.id, now()
         FROM permissions p
         WHERE p.code = $2
         ON CONFLICT (role_id, permission_id) DO NOTHING
         RETURNING $2::text AS code`,
        [roleId, permissionCode],
      );
      const code = inserted.rows[0]?.['code'];
      if (typeof code === 'string') {
        addedCodes.push(code);
      }
    }

    roles.push({
      code: def.code,
      roleId,
      removedCodes: removed.rows
        .map((row) => row['code'])
        .filter((code): code is string => typeof code === 'string')
        .sort(),
      addedCodes: addedCodes.sort(),
    });
  }

  return {
    tenantId: input.tenantId,
    roles,
  };
}
