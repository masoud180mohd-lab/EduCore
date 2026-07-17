/**
 * Read path: tenant memberships for the bound tenant (RLS Pattern A + own-row).
 * No invite/suspend/remove — product read increments only.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type MembershipRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: string;
  readonly joinedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListMembershipsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'invited' | 'active' | 'suspended' | 'removed' | undefined;
};

export type ListMembershipsResult = {
  readonly rows: ReadonlyArray<MembershipRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class MembershipsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of memberships for the bound tenant under RLS.
   * Fail-closed: invalid ids / no pool / errors → empty page (warn on DB errors).
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    query: ListMembershipsQuery,
  ): Promise<ListMembershipsResult> {
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
          SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at,
                 m.created_at, m.updated_at
          FROM tenant_memberships m
          WHERE m.tenant_id = $1::uuid`;

        if (query.status !== undefined) {
          params.push(query.status);
          sql += ` AND m.status = $${String(params.length)}`;
        }

        if (query.cursor !== undefined) {
          params.push(query.cursor);
          sql += `
            AND (m.created_at, m.id) > (
              SELECT m2.created_at, m2.id FROM tenant_memberships m2
              WHERE m2.id = $${String(params.length)}::uuid
                AND m2.tenant_id = $1::uuid
            )`;
        }

        sql += ` ORDER BY m.created_at ASC, m.id ASC LIMIT $2`;

        const result = await client.query<{
          id: string;
          tenant_id: string;
          user_id: string;
          status: string;
          joined_at: Date | null;
          created_at: Date;
          updated_at: Date;
        }>(sql, params);

        const hasMore = result.rows.length > query.limit;
        const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
        const mapped = pageRows.map(mapMembershipRow);
        const last = mapped[mapped.length - 1];
        return {
          rows: mapped,
          nextCursor: hasMore && last !== undefined ? last.id : null,
        };
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MembershipsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single membership by id in the bound tenant under RLS.
   * Returns null when missing, not accessible, invalid ids, no pool, or DB errors
   * (caller maps to 404 — no existence leak).
   */
  async getByIdForTenant(
    userId: string,
    tenantId: string,
    membershipId: string,
  ): Promise<MembershipRow | null> {
    if (!isUuid(userId) || !isUuid(tenantId) || !isUuid(membershipId) || this.pool === null) {
      return null;
    }

    try {
      return await withTenantTransaction(this.pool, { userId, tenantId }, async (client) => {
        const result = await client.query<{
          id: string;
          tenant_id: string;
          user_id: string;
          status: string;
          joined_at: Date | null;
          created_at: Date;
          updated_at: Date;
        }>(
          `SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at,
                  m.created_at, m.updated_at
           FROM tenant_memberships m
           WHERE m.tenant_id = $1::uuid
             AND m.id = $2::uuid
           LIMIT 1`,
          [tenantId, membershipId],
        );
        const row = result.rows[0];
        return row === undefined ? null : mapMembershipRow(row);
      });
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MembershipsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }
}

function mapMembershipRow(row: {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): MembershipRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    status: row.status,
    joinedAt: row.joined_at === null ? null : new Date(row.joined_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
