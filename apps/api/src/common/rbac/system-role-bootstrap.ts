/** Trusted-platform bootstrap for per-tenant system roles. */
import { randomUUID } from 'node:crypto';

import type pg from 'pg';

import { isSystemRoleCode, SYSTEM_ROLE_DEFINITIONS, type SystemRoleCode } from './system-roles.js';

export type BootstrapSystemRolesInput = {
  readonly tenantId: string;
  readonly assignUserId?: string;
  readonly assignRoleCode?: SystemRoleCode;
  readonly roleIds?: Partial<Record<SystemRoleCode, string>>;
  readonly userRoleId?: string;
};

export type BootstrapSystemRolesResult = {
  readonly tenantId: string;
  readonly roles: ReadonlyArray<{ readonly code: SystemRoleCode; readonly id: string }>;
  readonly assigned: {
    readonly userId: string;
    readonly roleCode: SystemRoleCode;
    readonly userRoleId: string;
  } | null;
};

type Queryable = Pick<pg.Client | pg.PoolClient, 'query'>;

export async function bootstrapSystemRolesForTenant(
  client: Queryable,
  input: BootstrapSystemRolesInput,
): Promise<BootstrapSystemRolesResult> {
  const roles: Array<{ code: SystemRoleCode; id: string }> = [];

  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    const preferredId = input.roleIds?.[def.code] ?? randomUUID();
    await client.query(
      `INSERT INTO roles (id, tenant_id, code, name, is_system, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, true, now(), now())
       ON CONFLICT (tenant_id, code) DO UPDATE
         SET name = EXCLUDED.name, is_system = true, updated_at = now()`,
      [preferredId, input.tenantId, def.code, def.name],
    );

    const resolved = await client.query<{ id: string }>(
      'SELECT id FROM roles WHERE tenant_id = $1::uuid AND code = $2 LIMIT 1',
      [input.tenantId, def.code],
    );
    const roleId = resolved.rows[0]?.id;
    if (roleId === undefined)
      throw new Error(`failed to resolve system role ${def.code} for tenant`);

    for (const permissionCode of def.permissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id, created_at)
         SELECT $1::uuid, p.id, now() FROM permissions p WHERE p.code = $2
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleId, permissionCode],
      );
    }
    roles.push({ code: def.code, id: roleId });
  }

  let assigned: BootstrapSystemRolesResult['assigned'] = null;
  if (input.assignUserId !== undefined && input.assignUserId !== '') {
    const roleCode =
      input.assignRoleCode !== undefined && isSystemRoleCode(input.assignRoleCode)
        ? input.assignRoleCode
        : 'owner';
    const roleRow = roles.find((role) => role.code === roleCode);
    if (roleRow === undefined) throw new Error(`system role ${roleCode} missing after bootstrap`);

    const existing = await client.query<{ id: string }>(
      'SELECT id FROM user_roles WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND role_id = $3::uuid AND organization_id IS NULL LIMIT 1',
      [input.tenantId, input.assignUserId, roleRow.id],
    );
    let userRoleId = existing.rows[0]?.id;
    if (userRoleId === undefined) {
      userRoleId = input.userRoleId ?? randomUUID();
      await client.query(
        `INSERT INTO user_roles (id, tenant_id, user_id, role_id, organization_id, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, NULL, now()) ON CONFLICT DO NOTHING`,
        [userRoleId, input.tenantId, input.assignUserId, roleRow.id],
      );
      const again = await client.query<{ id: string }>(
        'SELECT id FROM user_roles WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND role_id = $3::uuid AND organization_id IS NULL LIMIT 1',
        [input.tenantId, input.assignUserId, roleRow.id],
      );
      userRoleId = again.rows[0]?.id ?? userRoleId;
    }
    assigned = { userId: input.assignUserId, roleCode, userRoleId };
  }

  return { tenantId: input.tenantId, roles, assigned };
}
