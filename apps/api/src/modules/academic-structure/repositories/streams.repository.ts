/**
 * Streams under a class (RLS Pattern A / DBF-006).
 * List + get-by-id + create + patch/reparent (IMP-013/IMP-014) + delete (IMP-014)
 * via SECURITY DEFINER.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type StreamRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly classId: string;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListStreamsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly classId: string | undefined;
  readonly status: 'draft' | 'active' | 'closed' | undefined;
  readonly search: string | undefined;
};

@Injectable()
export class StreamsRepository {
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
    query: ListStreamsQuery,
  ): Promise<{ rows: ReadonlyArray<StreamRow>; nextCursor: string | null }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    if (query.classId !== undefined && !isUuid(query.classId)) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT s.id, s.tenant_id, s.class_id, s.name, s.code, s.status,
                   s.created_at, s.updated_at
            FROM streams s
            WHERE s.tenant_id = $1::uuid`;

          if (query.classId !== undefined) {
            params.push(query.classId);
            sql += ` AND s.class_id = $${String(params.length)}::uuid`;
          }
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
                SELECT 1 FROM streams cur
                WHERE cur.id = $${String(params.length)}::uuid
                  AND cur.tenant_id = $1::uuid
                  AND (s.name > cur.name OR (s.name = cur.name AND s.id > cur.id))
              )`;
          }
          sql += ` ORDER BY s.name ASC, s.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            class_id: string;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapStreamRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StreamsRepository', error, { operation: 'listForTenant' });
      return { rows: [], nextCursor: null };
    }
  }

  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    streamId: string,
  ): Promise<StreamRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(streamId) || this.pool === null) {
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
            class_id: string;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT s.id, s.tenant_id, s.class_id, s.name, s.code, s.status,
                    s.created_at, s.updated_at
             FROM streams s
             WHERE s.tenant_id = $1::uuid AND s.id = $2::uuid LIMIT 1`,
            [tenantId, streamId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStreamRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StreamsRepository', error, {
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
      readonly classId: string;
      readonly name: string;
      readonly code: string | undefined;
      readonly status: string;
    },
  ): Promise<StreamRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(input.id) ||
      !isUuid(input.classId) ||
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
            class_id: string;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, class_id, name, code, status, created_at, updated_at
             FROM app.create_stream(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.classId,
              input.name,
              input.code ?? null,
              input.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStreamRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StreamsRepository', error, {
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
    streamId: string,
    patch: {
      readonly setName: boolean;
      readonly name: string | null;
      readonly setCode: boolean;
      readonly code: string | null;
      readonly setStatus: boolean;
      readonly status: string | null;
      readonly setClassId: boolean;
      readonly classId: string | null;
    },
  ): Promise<StreamRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(streamId) || this.pool === null) {
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
            class_id: string;
            name: string;
            code: string | null;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, class_id, name, code, status, created_at, updated_at
             FROM app.update_stream(
               $1::uuid, $2::uuid, $3::uuid,
               $4::boolean, $5::text,
               $6::boolean, $7::text,
               $8::boolean, $9::text,
               $10::boolean, $11::uuid
             )`,
            [
              actorUserId,
              tenantId,
              streamId,
              patch.setName,
              patch.name,
              patch.setCode,
              patch.code,
              patch.setStatus,
              patch.status,
              patch.setClassId,
              patch.classId,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStreamRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StreamsRepository', error, {
        operation: 'updateForTenant',
      });
      throw error;
    }
  }

  /**
   * Delete via SECURITY DEFINER helper (IMP-014).
   * Returns null for invalid ids / no pool. Returns false when missing/other-tenant.
   * Returns true on success. Throws (P0001 'has dependents') for service → 409.
   */
  async deleteForTenant(
    actorUserId: string,
    tenantId: string,
    streamId: string,
  ): Promise<boolean | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(streamId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{ deleted: boolean }>(
            `SELECT app.delete_stream($1::uuid, $2::uuid, $3::uuid) AS deleted`,
            [actorUserId, tenantId, streamId],
          );
          return result.rows[0]?.deleted ?? false;
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StreamsRepository', error, {
        operation: 'deleteForTenant',
      });
      throw error;
    }
  }
}

function mapStreamRow(row: {
  id: string;
  tenant_id: string;
  class_id: string;
  name: string;
  code: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}): StreamRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    classId: row.class_id,
    name: row.name,
    code: row.code,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
