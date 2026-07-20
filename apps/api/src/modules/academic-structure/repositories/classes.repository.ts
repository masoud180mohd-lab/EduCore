/**
 * Classes in the bound tenant (RLS Pattern A / DBF-005).
 * List (C0). Detail/create later.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type ClassRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListClassesQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly academicYearId: string | undefined;
  readonly termId: string | undefined;
  readonly status: 'draft' | 'active' | 'closed' | undefined;
  readonly search: string | undefined;
};

export type ListClassesResult = {
  readonly rows: ReadonlyArray<ClassRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class ClassesRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of classes for the bound tenant under RLS.
   * Order: name ASC, id ASC (ACF-005 / DBF-005).
   * Fail-closed: invalid ids / no pool / errors → empty page.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: ListClassesQuery,
  ): Promise<ListClassesResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    if (query.academicYearId !== undefined && !isUuid(query.academicYearId)) {
      return { rows: [], nextCursor: null };
    }
    if (query.termId !== undefined && !isUuid(query.termId)) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT c.id, c.tenant_id, c.academic_year_id, c.term_id, c.name, c.code,
                   c.status, c.created_at, c.updated_at
            FROM classes c
            WHERE c.tenant_id = $1::uuid`;

          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND c.academic_year_id = $${String(params.length)}::uuid`;
          }

          if (query.termId !== undefined) {
            params.push(query.termId);
            sql += ` AND c.term_id = $${String(params.length)}::uuid`;
          }

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND c.status = $${String(params.length)}`;
          }

          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              c.name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR (
                c.code IS NOT NULL
                AND c.code ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              )
            )`;
          }

          if (query.cursor !== undefined) {
            params.push(query.cursor);
            // Keyset for ORDER BY name ASC, id ASC
            sql += `
              AND EXISTS (
                SELECT 1
                FROM classes cur
                WHERE cur.id = $${String(params.length)}::uuid
                  AND cur.tenant_id = $1::uuid
                  AND (
                    c.name > cur.name
                    OR (c.name = cur.name AND c.id > cur.id)
                  )
              )`;
          }

          sql += ` ORDER BY c.name ASC, c.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            academic_year_id: string;
            term_id: string | null;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapClassRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'ClassesRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }
}

function mapClassRow(row: {
  id: string;
  tenant_id: string;
  academic_year_id: string;
  term_id: string | null;
  name: string;
  code: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): ClassRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    name: row.name,
    code: row.code,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
