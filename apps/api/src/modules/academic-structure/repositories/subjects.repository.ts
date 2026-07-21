/**
 * Subjects catalogue (RLS Pattern A / DBF-007).
 * List + get-by-id + create via SECURITY DEFINER.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type SubjectRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListSubjectsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'draft' | 'active' | 'closed' | undefined;
  readonly search: string | undefined;
};

@Injectable()
export class SubjectsRepository {
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
    query: ListSubjectsQuery,
  ): Promise<{ rows: ReadonlyArray<SubjectRow>; nextCursor: string | null }> {
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
            SELECT s.id, s.tenant_id, s.name, s.code, s.status, s.created_at, s.updated_at
            FROM subjects s
            WHERE s.tenant_id = $1::uuid`;

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND s.status = $${String(params.length)}`;
          }
          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              s.name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR (s.code IS NOT NULL AND s.code ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\')
            )`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM subjects cur
                WHERE cur.id = $${String(params.length)}::uuid
                  AND cur.tenant_id = $1::uuid
                  AND (s.name > cur.name OR (s.name = cur.name AND s.id > cur.id))
              )`;
          }
          sql += ` ORDER BY s.name ASC, s.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapSubjectRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'SubjectsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    subjectId: string,
  ): Promise<SubjectRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(subjectId) || this.pool === null) {
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
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT s.id, s.tenant_id, s.name, s.code, s.status, s.created_at, s.updated_at
             FROM subjects s
             WHERE s.tenant_id = $1::uuid AND s.id = $2::uuid LIMIT 1`,
            [tenantId, subjectId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapSubjectRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'SubjectsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly name: string;
      readonly code: string | undefined;
      readonly status: string;
    },
  ): Promise<SubjectRow | null> {
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
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, name, code, status, created_at, updated_at
             FROM app.create_subject(
               $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text
             )`,
            [actorUserId, tenantId, input.id, input.name, input.code ?? null, input.status],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapSubjectRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'SubjectsRepository', error, {
        operation: 'createForTenant',
      });
      throw error;
    }
  }
}

function mapSubjectRow(row: {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): SubjectRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    code: row.code,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
