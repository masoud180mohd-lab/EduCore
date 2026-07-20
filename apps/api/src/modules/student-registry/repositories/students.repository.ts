/**
 * Students in the bound tenant (RLS Pattern A / DBF-002).
 * List (P0) + get-by-id (P1) + create (P2) + patch (P3) via SECURITY DEFINER.
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

export type StudentRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly studentCode: string | null;
  readonly displayName: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListStudentsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'draft' | undefined;
  readonly search: string | undefined;
};

export type ListStudentsResult = {
  readonly rows: ReadonlyArray<StudentRow>;
  readonly nextCursor: string | null;
};

@Injectable()
export class StudentsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  /**
   * Cursor page of students for the bound tenant under RLS.
   * Fail-closed: invalid ids / no pool / errors → empty page.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    query: ListStudentsQuery,
  ): Promise<ListStudentsResult> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status,
                   s.created_at, s.updated_at
            FROM students s
            WHERE s.tenant_id = $1::uuid`;

          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND s.status = $${String(params.length)}`;
          }

          if (query.search !== undefined) {
            params.push(query.search);
            sql += ` AND (
              s.display_name ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              OR (
                s.student_code IS NOT NULL
                AND s.student_code ILIKE '%' || $${String(params.length)} || '%' ESCAPE '\\'
              )
            )`;
          }

          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND (s.display_name, s.id) > (
                SELECT s2.display_name, s2.id FROM students s2
                WHERE s2.id = $${String(params.length)}::uuid
                  AND s2.tenant_id = $1::uuid
              )`;
          }

          sql += ` ORDER BY s.display_name ASC, s.id ASC LIMIT $2`;

          const result = await client.query<{
            id: string;
            tenant_id: string;
            student_code: string | null;
            display_name: string;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(sql, params);

          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapStudentRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StudentsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  /**
   * Single student by id in the bound tenant under RLS.
   * Returns null when missing, other-tenant, invalid ids, no pool, or DB errors
   * (caller maps to 404 — no existence leak).
   */
  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    studentId: string,
  ): Promise<StudentRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(studentId) || this.pool === null) {
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
            student_code: string | null;
            display_name: string;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status,
                    s.created_at, s.updated_at
             FROM students s
             WHERE s.tenant_id = $1::uuid
               AND s.id = $2::uuid
             LIMIT 1`,
            [tenantId, studentId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStudentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StudentsRepository', error, {
        operation: 'getByIdForTenant',
      });
      return null;
    }
  }

  /**
   * Create student via SECURITY DEFINER helper.
   * Throws on unique violation (23505) for service → 409.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly studentCode: string | undefined;
      readonly displayName: string;
      readonly status: string;
    },
  ): Promise<StudentRow | null> {
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
            student_code: string | null;
            display_name: string;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, student_code, display_name, status, created_at, updated_at
             FROM app.create_student(
               $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.studentCode ?? null,
              input.displayName,
              input.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStudentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StudentsRepository', error, {
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
    studentId: string,
    patch: {
      readonly setDisplayName: boolean;
      readonly displayName: string | null;
      readonly setStudentCode: boolean;
      readonly studentCode: string | null;
      readonly setStatus: boolean;
      readonly status: string | null;
    },
  ): Promise<StudentRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(studentId) || this.pool === null) {
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
            student_code: string | null;
            display_name: string;
            status: string;
            created_at: Date;
            updated_at: Date;
          }>(
            `SELECT id, tenant_id, student_code, display_name, status, created_at, updated_at
             FROM app.update_student(
               $1::uuid, $2::uuid, $3::uuid,
               $4::boolean, $5::text,
               $6::boolean, $7::text,
               $8::boolean, $9::text
             )`,
            [
              actorUserId,
              tenantId,
              studentId,
              patch.setDisplayName,
              patch.displayName,
              patch.setStudentCode,
              patch.studentCode,
              patch.setStatus,
              patch.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapStudentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'StudentsRepository', error, {
        operation: 'updateForTenant',
      });
      throw error;
    }
  }
}

function mapStudentRow(row: {
  id: string;
  tenant_id: string;
  student_code: string | null;
  display_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}): StudentRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentCode: row.student_code,
    displayName: row.display_name,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
