import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type UserRoleRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly organizationId: string | null;
  readonly roleCode: string;
  readonly createdAt: string;
};

export type ListUserRolesResult = {
  readonly rows: ReadonlyArray<UserRoleRow>;
  readonly nextCursor: string | null;
};

type DbUserRoleRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  organization_id: string | null;
  role_code: string;
  created_at: Date;
};

@Injectable()
export class UserRolesRepository {
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
    query: {
      readonly limit: number;
      readonly cursor: string | undefined;
      readonly userId: string | undefined;
    },
  ): Promise<ListUserRolesResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `${userRoleSelect()} WHERE ur.tenant_id = $1::uuid`;
          if (query.userId !== undefined) {
            params.push(query.userId);
            sql += ` AND ur.user_id = $${String(params.length)}::uuid`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
            AND (ur.created_at, ur.id) > (
              SELECT ur2.created_at, ur2.id FROM user_roles ur2
              WHERE ur2.id = $${String(params.length)}::uuid
                AND ur2.tenant_id = $1::uuid
            )`;
          }
          sql += ` ORDER BY ur.created_at ASC, ur.id ASC LIMIT $2`;
          const result = await client.query<DbUserRoleRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const rows = (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapUserRole);
          return {
            rows,
            nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'UserRolesRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async assignForTenant(
    actorUserId: string,
    tenantId: string,
    input: { readonly userRoleId: string; readonly userId: string; readonly roleId: string },
  ): Promise<UserRoleRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(input.userRoleId) ||
      !isUuid(input.userId) ||
      !isUuid(input.roleId) ||
      this.pool === null
    ) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          await client.query(
            `SELECT * FROM app.assign_user_role(
             $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid
           )`,
            [actorUserId, tenantId, input.userRoleId, input.userId, input.roleId],
          );
          return selectUserRole(client, tenantId, input.userRoleId);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'UserRolesRepository', error, {
        operation: 'assignForTenant',
      });
      throw error;
    }
  }

  async unassignForTenant(
    actorUserId: string,
    tenantId: string,
    userRoleId: string,
  ): Promise<boolean> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(userRoleId) || this.pool === null) {
      return false;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query(
            `SELECT * FROM app.unassign_user_role($1::uuid, $2::uuid, $3::uuid)`,
            [actorUserId, tenantId, userRoleId],
          );
          return result.rowCount === 1;
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'UserRolesRepository', error, {
        operation: 'unassignForTenant',
      });
      throw error;
    }
  }
}

function userRoleSelect(): string {
  return `
    SELECT ur.id, ur.tenant_id, ur.user_id, ur.role_id, ur.organization_id,
           r.code AS role_code, ur.created_at
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id`;
}

async function selectUserRole(
  client: PoolClient,
  tenantId: string,
  userRoleId: string,
): Promise<UserRoleRow | null> {
  const result = await client.query<DbUserRoleRow>(
    `${userRoleSelect()}
     WHERE ur.tenant_id = $1::uuid AND ur.id = $2::uuid
     LIMIT 1`,
    [tenantId, userRoleId],
  );
  const row = result.rows[0];
  return row === undefined ? null : mapUserRole(row);
}

function mapUserRole(row: DbUserRoleRow): UserRoleRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    roleId: row.role_id,
    organizationId: row.organization_id,
    roleCode: row.role_code,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
