import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type RoleRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly permissions: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListRolesResult = {
  readonly rows: ReadonlyArray<RoleRow>;
  readonly nextCursor: string | null;
};

type DbRoleRow = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  is_system: boolean;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class RolesRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: { readonly limit: number; readonly cursor: string | undefined },
  ): Promise<ListRolesResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let cursorClause = '';
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            cursorClause = `
            AND (r.code, r.id) > (
              SELECT r2.code, r2.id FROM roles r2
              WHERE r2.id = $3::uuid AND r2.tenant_id = $1::uuid
            )`;
          }
          const result = await client.query<DbRoleRow>(
            `${roleSelect()}
           WHERE r.tenant_id = $1::uuid
           ${cursorClause}
           GROUP BY r.id
           ORDER BY r.code ASC, r.id ASC
           LIMIT $2`,
            params,
          );
          const hasMore = result.rows.length > query.limit;
          const rows = (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapRole);
          return {
            rows,
            nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'RolesRepository', error, { operation: 'listForTenant' });
      return { rows: [], nextCursor: null };
    }
  }

  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    roleId: string,
  ): Promise<RoleRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(roleId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, (client) =>
        selectRole(client, tenantId, roleId),
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'RolesRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly roleId: string;
      readonly code: string;
      readonly name: string;
      readonly permissionCodes: ReadonlyArray<string>;
    },
  ): Promise<RoleRow | null> {
    return this.writeRole(
      actorUserId,
      tenantId,
      input.roleId,
      'createForTenant',
      async (client) => {
        await client.query(
          `SELECT * FROM app.create_custom_role(
           $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text[]
         )`,
          [actorUserId, tenantId, input.roleId, input.code, input.name, [...input.permissionCodes]],
        );
      },
    );
  }

  async renameForTenant(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    name: string,
  ): Promise<RoleRow | null> {
    return this.writeRole(actorUserId, tenantId, roleId, 'renameForTenant', async (client) => {
      await client.query(`SELECT * FROM app.rename_role($1::uuid, $2::uuid, $3::uuid, $4::text)`, [
        actorUserId,
        tenantId,
        roleId,
        name,
      ]);
    });
  }

  async replacePermissionsForTenant(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    permissionCodes: ReadonlyArray<string>,
  ): Promise<RoleRow | null> {
    return this.writeRole(
      actorUserId,
      tenantId,
      roleId,
      'replacePermissionsForTenant',
      async (client) => {
        await client.query(
          `SELECT * FROM app.replace_role_permissions(
             $1::uuid, $2::uuid, $3::uuid, $4::text[]
           )`,
          [actorUserId, tenantId, roleId, [...permissionCodes]],
        );
      },
    );
  }

  private async writeRole(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    operation: string,
    write: (client: PoolClient) => Promise<void>,
  ): Promise<RoleRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(roleId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          await write(client);
          return selectRole(client, tenantId, roleId);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'RolesRepository', error, { operation });
      throw error;
    }
  }
}

function roleSelect(): string {
  return `
    SELECT r.id, r.tenant_id, r.code, r.name, r.is_system,
           COALESCE(
             array_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL),
             ARRAY[]::text[]
           ) AS permissions,
           r.created_at, r.updated_at
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id`;
}

async function selectRole(
  client: PoolClient,
  tenantId: string,
  roleId: string,
): Promise<RoleRow | null> {
  const result = await client.query<DbRoleRow>(
    `${roleSelect()}
     WHERE r.tenant_id = $1::uuid AND r.id = $2::uuid
     GROUP BY r.id
     LIMIT 1`,
    [tenantId, roleId],
  );
  const row = result.rows[0];
  return row === undefined ? null : mapRole(row);
}

function mapRole(row: DbRoleRow): RoleRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    isSystem: row.is_system,
    permissions: row.permissions,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
