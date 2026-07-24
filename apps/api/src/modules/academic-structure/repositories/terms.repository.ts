/**
 * Terms in the bound tenant (RLS Pattern A / DBF-004).
 * List (P3) + get-by-id (P4) + create (P5) + patch (IMP-013) via SECURITY DEFINER.
 * No DELETE.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type TermRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListTermsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly academicYearId: string | undefined;
  readonly status: 'draft' | 'active' | 'closed' | undefined;
  readonly search: string | undefined;
};

export type ListTermsResult = {
  readonly rows: ReadonlyArray<TermRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class TermsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of terms for the bound tenant under RLS.
   * Order: starts_on ASC NULLS LAST, id ASC (ACF-004 / DBF-004).
   * Fail-closed: invalid ids / no pool / errors → empty page.
   * academicYearId (when set) must already be a valid UUID; missing/other-tenant year → empty.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: ListTermsQuery,
  ): Promise<ListTermsResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    if (query.academicYearId !== undefined && !isUuid(query.academicYearId)) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.code,
                   t.starts_on, t.ends_on, t.status, t.created_at, t.updated_at
            FROM terms t
            WHERE t.tenant_id = $1::uuid`;

          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND t.academic_year_id = $${String(params.length)}::uuid`;
          }

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND t.status = $${String(params.length)}`;
          }

          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              t.name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR (
                t.code IS NOT NULL
                AND t.code ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              )
            )`;
          }

          if (query.cursor !== undefined) {
            params.push(query.cursor);
            // Keyset for ORDER BY starts_on ASC NULLS LAST, id ASC
            sql += `
              AND EXISTS (
                SELECT 1
                FROM terms c
                WHERE c.id = $${String(params.length)}::uuid
                  AND c.tenant_id = $1::uuid
                  AND (
                    (
                      c.starts_on IS NOT NULL
                      AND (
                        (t.starts_on IS NOT NULL AND t.starts_on > c.starts_on)
                        OR (t.starts_on IS NOT NULL AND t.starts_on = c.starts_on AND t.id > c.id)
                        OR t.starts_on IS NULL
                      )
                    )
                    OR (
                      c.starts_on IS NULL
                      AND t.starts_on IS NULL
                      AND t.id > c.id
                    )
                  )
              )`;
          }

          sql += ` ORDER BY t.starts_on ASC NULLS LAST, t.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            academic_year_id: string;
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
          const mapped = pageRows.map(mapTermRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'TermsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single term by id in the bound tenant under RLS.
   * Returns null when missing, other-tenant, invalid ids, no pool, or DB errors
   * (caller maps to 404 — no existence leak).
   */
  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    termId: string,
  ): Promise<TermRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(termId) || this.pool === null) {
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
            academic_year_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.code,
                    t.starts_on, t.ends_on, t.status, t.created_at, t.updated_at
             FROM terms t
             WHERE t.tenant_id = $1::uuid
               AND t.id = $2::uuid
             LIMIT 1`,
            [tenantId, termId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapTermRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'TermsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }

  /**
   * Create term via SECURITY DEFINER helper.
   * Throws on unique violation (23505) for service → 409.
   * Throws on parent year miss (22023 + message) for service → 400.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly academicYearId: string;
      readonly name: string;
      readonly code: string | undefined;
      readonly startsOn: string | null;
      readonly endsOn: string | null;
      readonly status: string;
    },
  ): Promise<TermRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(input.id) ||
      !isUuid(input.academicYearId) ||
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
            academic_year_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, academic_year_id, name, code, starts_on, ends_on,
                    status, created_at, updated_at
             FROM app.create_term(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text,
               $7::date, $8::date, $9::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.academicYearId,
              input.name,
              input.code ?? null,
              input.startsOn,
              input.endsOn,
              input.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapTermRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'TermsRepository', error, {
        operation: 'createForTenant',
      });
      throw error;
    }
  }

  /**
   * Partial update via SECURITY DEFINER helper.
   * Returns null when missing/other-tenant (empty helper result) or invalid ids / no pool.
   * Throws on unique violation (23505) for service → 409.
   */
  async updateForTenant(
    actorUserId: string,
    tenantId: string,
    termId: string,
    patch: {
      readonly setName: boolean;
      readonly name: string | null;
      readonly setCode: boolean;
      readonly code: string | null;
      readonly setStartsOn: boolean;
      readonly startsOn: string | null;
      readonly setEndsOn: boolean;
      readonly endsOn: string | null;
      readonly setStatus: boolean;
      readonly status: string | null;
    },
  ): Promise<TermRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(termId) || this.pool === null) {
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
            academic_year_id: string;
            name: string;
            code: string | null;
            starts_on: Date | string | null;
            ends_on: Date | string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, academic_year_id, name, code, starts_on, ends_on,
                    status, created_at, updated_at
             FROM app.update_term(
               $1::uuid, $2::uuid, $3::uuid,
               $4::boolean, $5::text,
               $6::boolean, $7::text,
               $8::boolean, $9::date,
               $10::boolean, $11::date,
               $12::boolean, $13::text
             )`,
            [
              actorUserId,
              tenantId,
              termId,
              patch.setName,
              patch.name,
              patch.setCode,
              patch.code,
              patch.setStartsOn,
              patch.startsOn,
              patch.setEndsOn,
              patch.endsOn,
              patch.setStatus,
              patch.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapTermRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'TermsRepository', error, {
        operation: 'updateForTenant',
      });
      throw error;
    }
  }
}

function mapTermRow(row: {
  id: string;
  tenant_id: string;
  academic_year_id: string;
  name: string;
  code: string | null;
  starts_on: Date | string | null;
  ends_on: Date | string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): TermRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicYearId: row.academic_year_id,
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
    return value.slice(0, 10);
  }
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}
