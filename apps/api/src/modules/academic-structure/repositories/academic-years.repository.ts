/**
 * Academic years in the bound tenant (RLS Pattern A / DBF-003).
 * List (P0) + get-by-id (P1) + create (P2 via SECURITY DEFINER).
 * No PATCH/DELETE.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type AcademicYearRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly code: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListAcademicYearsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'draft' | 'active' | 'closed' | undefined;
  readonly search: string | undefined;
};

export type ListAcademicYearsResult = {
  readonly rows: ReadonlyArray<AcademicYearRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class AcademicYearsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of academic years for the bound tenant under RLS.
   * Order: starts_on DESC NULLS LAST, id ASC (ACF-003 / DBF-003).
   * Fail-closed: invalid ids / no pool / errors → empty page.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: ListAcademicYearsQuery,
  ): Promise<ListAcademicYearsResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT y.id, y.tenant_id, y.name, y.code, y.starts_on, y.ends_on, y.status,
                   y.created_at, y.updated_at
            FROM academic_years y
            WHERE y.tenant_id = $1::uuid`;

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND y.status = $${String(params.length)}`;
          }

          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              y.name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR (
                y.code IS NOT NULL
                AND y.code ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              )
            )`;
          }

          if (query.cursor !== undefined) {
            params.push(query.cursor);
            // Keyset for ORDER BY starts_on DESC NULLS LAST, id ASC
            sql += `
              AND EXISTS (
                SELECT 1
                FROM academic_years c
                WHERE c.id = $${String(params.length)}::uuid
                  AND c.tenant_id = $1::uuid
                  AND (
                    (
                      c.starts_on IS NOT NULL
                      AND (
                        (y.starts_on IS NOT NULL AND y.starts_on < c.starts_on)
                        OR (y.starts_on IS NOT NULL AND y.starts_on = c.starts_on AND y.id > c.id)
                        OR y.starts_on IS NULL
                      )
                    )
                    OR (
                      c.starts_on IS NULL
                      AND y.starts_on IS NULL
                      AND y.id > c.id
                    )
                  )
              )`;
          }

          sql += ` ORDER BY y.starts_on DESC NULLS LAST, y.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapAcademicYearRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AcademicYearsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single academic year by id in the bound tenant under RLS.
   * Returns null when missing, other-tenant, invalid ids, no pool, or DB errors
   * (caller maps to 404 — no existence leak).
   */
  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    academicYearId: string,
  ): Promise<AcademicYearRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(academicYearId) ||
      this.pool === null
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
            tenant_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT y.id, y.tenant_id, y.name, y.code, y.starts_on, y.ends_on, y.status,
                    y.created_at, y.updated_at
             FROM academic_years y
             WHERE y.tenant_id = $1::uuid
               AND y.id = $2::uuid
             LIMIT 1`,
            [tenantId, academicYearId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapAcademicYearRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AcademicYearsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }

  /**
   * Create academic year via SECURITY DEFINER helper.
   * Throws on unique violation (23505) for service → 409.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly name: string;
      readonly code: string | undefined;
      readonly startsOn: string | null;
      readonly endsOn: string | null;
      readonly status: string;
    },
  ): Promise<AcademicYearRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(input.id) || this.pool === null) {
      return null;
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            id: string;
            tenant_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, name, code, starts_on, ends_on, status, created_at, updated_at
             FROM app.create_academic_year(
               $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::date, $7::date, $8::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.name,
              input.code ?? null,
              input.startsOn,
              input.endsOn,
              input.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapAcademicYearRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AcademicYearsRepository', error, {
        operation: 'createForTenant',
      });
      throw error;
    }
  }
}

function mapAcademicYearRow(row: {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  starts_on: Date | string | null;
  ends_on: Date | string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): AcademicYearRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    code: row.code,
    startsOn: formatDateOnly(row.starts_on),
    endsOn: formatDateOnly(row.ends_on),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** ISO date YYYY-MM-DD or null (no time component in public envelope). */
function formatDateOnly(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    // pg may return date as 'YYYY-MM-DD' string
    return value.slice(0, 10);
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}
