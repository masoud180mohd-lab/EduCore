/**
 * Read path: organizations visible in the bound tenant (RLS Pattern A).
 * No create/update/delete — product read increments only.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type OrganizationRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly orgType: string;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
  readonly parentOrganizationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListOrganizationsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'active' | 'inactive' | undefined;
};

export type ListOrganizationsResult = {
  readonly rows: ReadonlyArray<OrganizationRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class OrganizationsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of organizations for the bound tenant under RLS.
   * Fail-closed: invalid ids / no pool / errors → empty page (warn on DB errors).
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    query: ListOrganizationsQuery,
  ): Promise<ListOrganizationsResult> {
    if (!isUuid(userId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const params: unknown[] = [tenantId, query.limit + 1];
        let sql = `
          SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
                 o.parent_organization_id, o.created_at, o.updated_at
          FROM organizations o
          WHERE o.tenant_id = $1::uuid`;

        if (query.status !== undefined) {
          params.push(query.status);
          sql += ` AND o.status = $${String(params.length)}`;
        }

        if (query.cursor !== undefined) {
          // Keyset on (name, id) for stable order; cursor is the last seen id.
          params.push(query.cursor);
          sql += `
            AND (o.name, o.id) > (
              SELECT o2.name, o2.id FROM organizations o2
              WHERE o2.id = $${String(params.length)}::uuid
                AND o2.tenant_id = $1::uuid
            )`;
        }

        sql += ` ORDER BY o.name ASC, o.id ASC LIMIT $2`;

        const result = await client.query<{
          id: string;
          tenant_id: string;
          org_type: string;
          name: string;
          code: string | null;
          status: string;
          parent_organization_id: string | null;
          created_at: Date;
          updated_at: Date;
        }>(sql, params);

        const hasMore = result.rows.length > query.limit;
        const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
        const mapped = pageRows.map(mapOrganizationRow);
        const last = mapped[mapped.length - 1];
        return {
          rows: mapped,
          nextCursor: hasMore && last !== undefined ? last.id : null,
        };
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'OrganizationsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single organization by id in the bound tenant under RLS.
   * Returns null when missing, not accessible, invalid ids, no pool, or DB errors
   * (caller maps to 404 — no existence leak).
   */
  async getByIdForTenant(
    userId: string,
    tenantId: string,
    organizationId: string,
  ): Promise<OrganizationRow | null> {
    if (!isUuid(userId) || !isUuid(tenantId) || !isUuid(organizationId) || this.pool === null) {
      return null;
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{
          id: string;
          tenant_id: string;
          org_type: string;
          name: string;
          code: string | null;
          status: string;
          parent_organization_id: string | null;
          created_at: Date;
          updated_at: Date;
        }>(
          `SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
                  o.parent_organization_id, o.created_at, o.updated_at
           FROM organizations o
           WHERE o.tenant_id = $1::uuid
             AND o.id = $2::uuid
           LIMIT 1`,
          [tenantId, organizationId],
        );
        const row = result.rows[0];
        return row === undefined ? null : mapOrganizationRow(row);
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'OrganizationsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }
}

function mapOrganizationRow(row: {
  id: string;
  tenant_id: string;
  org_type: string;
  name: string;
  code: string | null;
  status: string;
  parent_organization_id: string | null;
  created_at: Date;
  updated_at: Date;
}): OrganizationRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orgType: row.org_type,
    name: row.name,
    code: row.code,
    status: row.status,
    parentOrganizationId: row.parent_organization_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
