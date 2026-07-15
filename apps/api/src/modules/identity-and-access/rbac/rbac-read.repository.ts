/**
 * Read-only RBAC resolution for the app pool (educore_app).
 * Writes stay on trusted platform bootstrap (seed scripts).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type UserRoleSummary = {
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
};

@Injectable()
export class RbacReadRepository {
  constructor(@Optional() @Inject(PG_POOL) private readonly pool: Pool | null) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Roles assigned to user in tenant (active membership still required by callers for AuthZ).
   * Fail-closed: invalid ids / no pool / errors → empty list.
   */
  async listRolesForUser(
    userId: string,
    tenantId: string,
  ): Promise<ReadonlyArray<UserRoleSummary>> {
    if (!isUuid(userId) || !isUuid(tenantId) || this.pool === null) {
      return [];
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{
          code: string;
          name: string;
          is_system: boolean;
        }>(
          `SELECT r.code, r.name, r.is_system
           FROM user_roles ur
           INNER JOIN roles r
             ON r.id = ur.role_id
            AND r.tenant_id = ur.tenant_id
           WHERE ur.tenant_id = $1::uuid
             AND ur.user_id = $2::uuid
           ORDER BY r.code ASC`,
          [tenantId, userId],
        );
        return result.rows.map((row) => ({
          code: row.code,
          name: row.name,
          isSystem: row.is_system,
        }));
      });
    } catch {
      return [];
    }
  }
}
