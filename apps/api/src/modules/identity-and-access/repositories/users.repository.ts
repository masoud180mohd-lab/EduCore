/**
 * Read path: users visible in the bound tenant via tenant memberships (ACF 4.5 / Q5).
 * Never selects password_hash or other credential columns.
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

export type UserRow = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: string;
  readonly emailVerifiedAt: string | null;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TenantMembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';

export type ListUsersQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'invited' | 'active' | 'disabled' | 'locked' | undefined;
  /** Membership rows that qualify the user for tenant directory visibility. */
  readonly membershipStatuses: ReadonlyArray<TenantMembershipStatus>;
  /** Escaped ILIKE fragment for display_name / email (service-sanitized). */
  readonly search: string | undefined;
};

export type ListUsersResult = {
  readonly rows: ReadonlyArray<UserRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class UsersRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of users visible via tenant membership in the bound tenant.
   * Defense-in-depth: explicit membership EXISTS + RLS Pattern C (can_see_user).
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: ListUsersQuery,
  ): Promise<ListUsersResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.membershipStatuses.length === 0) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, [...query.membershipStatuses], query.limit + 1];
          let sql = `
            SELECT u.id, u.email::text AS email, u.display_name, u.status,
                   u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
            FROM users u
            WHERE EXISTS (
              SELECT 1
              FROM tenant_memberships m
              WHERE m.user_id = u.id
                AND m.tenant_id = $1::uuid
                AND m.status = ANY($2::text[])
            )`;

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND u.status = $${String(params.length)}`;
          }

          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              u.display_name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR u.email::text ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
            )`;
          }

          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND (u.display_name, u.id) > (
                SELECT u2.display_name, u2.id FROM users u2
                WHERE u2.id = $${String(params.length)}::uuid
                  AND EXISTS (
                    SELECT 1 FROM tenant_memberships m2
                    WHERE m2.user_id = u2.id
                      AND m2.tenant_id = $1::uuid
                      AND m2.status = ANY($2::text[])
                  )
              )`;
          }

          sql += ` ORDER BY u.display_name ASC, u.id ASC LIMIT $3`;

          const result = await client.query<{
            id: string;
            email: string;
            display_name: string;
            status: string;
            email_verified_at: Date | null;
            last_login_at: Date | null;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapUserRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'UsersRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single user by id when visible in bound tenant (membership + RLS).
   * Returns null when missing / not accessible (caller → 404).
   */
  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    targetUserId: string,
    membershipStatuses: ReadonlyArray<TenantMembershipStatus>,
  ): Promise<UserRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(targetUserId) ||
      this.pool === null ||
      membershipStatuses.length === 0
    ) {
      return null;
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            id: string;
            email: string;
            display_name: string;
            status: string;
            email_verified_at: Date | null;
            last_login_at: Date | null;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT u.id, u.email::text AS email, u.display_name, u.status,
                    u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
             FROM users u
             WHERE u.id = $3::uuid
               AND EXISTS (
                 SELECT 1
                 FROM tenant_memberships m
                 WHERE m.user_id = u.id
                   AND m.tenant_id = $1::uuid
                   AND m.status = ANY($2::text[])
               )
             LIMIT 1`,
            [tenantId, [...membershipStatuses], targetUserId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapUserRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'UsersRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }
}

function mapUserRow(row: {
  id: string;
  email: string;
  display_name: string;
  status: string;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): UserRow {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    emailVerifiedAt:
      row.email_verified_at === null ? null : new Date(row.email_verified_at).toISOString(),
    lastLoginAt: row.last_login_at === null ? null : new Date(row.last_login_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
