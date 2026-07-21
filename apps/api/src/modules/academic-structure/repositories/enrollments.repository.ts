/**
 * Enrollments (RLS Pattern A / DBF-008).
 * List + get-by-id + create + status update via SECURITY DEFINER.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type EnrollmentRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly classId: string;
  readonly streamId: string | null;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly status: string;
  readonly enrolledAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListEnrollmentsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
  readonly studentId: string | undefined;
  readonly classId: string | undefined;
  readonly academicYearId: string | undefined;
  readonly streamId: string | undefined;
  readonly status: 'active' | 'withdrawn' | 'completed' | 'suspended' | undefined;
};

type EnrollmentDbRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  stream_id: string | null;
  academic_year_id: string;
  term_id: string | null;
  status: string;
  enrolled_at: Date;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class EnrollmentsRepository {
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
    query: ListEnrollmentsQuery,
  ): Promise<{ rows: ReadonlyArray<EnrollmentRow>; nextCursor: string | null }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    for (const id of [query.studentId, query.classId, query.academicYearId, query.streamId]) {
      if (id !== undefined && !isUuid(id)) {
        return { rows: [], nextCursor: null };
      }
    }

    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT e.id, e.tenant_id, e.student_id, e.class_id, e.stream_id,
                   e.academic_year_id, e.term_id, e.status, e.enrolled_at,
                   e.created_at, e.updated_at
            FROM enrollments e
            WHERE e.tenant_id = $1::uuid`;

          if (query.studentId !== undefined) {
            params.push(query.studentId);
            sql += ` AND e.student_id = $${String(params.length)}::uuid`;
          }
          if (query.classId !== undefined) {
            params.push(query.classId);
            sql += ` AND e.class_id = $${String(params.length)}::uuid`;
          }
          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND e.academic_year_id = $${String(params.length)}::uuid`;
          }
          if (query.streamId !== undefined) {
            params.push(query.streamId);
            sql += ` AND e.stream_id = $${String(params.length)}::uuid`;
          }
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND e.status = $${String(params.length)}`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            // Keyset: created_at ASC, id ASC
            sql += `
              AND EXISTS (
                SELECT 1 FROM enrollments cur
                WHERE cur.id = $${String(params.length)}::uuid
                  AND cur.tenant_id = $1::uuid
                  AND (
                    e.created_at > cur.created_at
                    OR (e.created_at = cur.created_at AND e.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY e.created_at ASC, e.id ASC LIMIT $2`;

          const result = await client.query<EnrollmentDbRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const pageRows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = pageRows.map(mapEnrollmentRow);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'EnrollmentsRepository', error, {
        operation: 'listForTenant',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async getByIdForTenant(
    actorUserId: string,
    tenantId: string,
    enrollmentId: string,
  ): Promise<EnrollmentRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(enrollmentId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<EnrollmentDbRow>(
            `SELECT e.id, e.tenant_id, e.student_id, e.class_id, e.stream_id,
                    e.academic_year_id, e.term_id, e.status, e.enrolled_at,
                    e.created_at, e.updated_at
             FROM enrollments e
             WHERE e.tenant_id = $1::uuid AND e.id = $2::uuid LIMIT 1`,
            [tenantId, enrollmentId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapEnrollmentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'EnrollmentsRepository', error, {
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
      readonly studentId: string;
      readonly classId: string;
      readonly streamId: string | null;
      readonly status: string;
    },
  ): Promise<EnrollmentRow | null> {
    if (
      !isUuid(actorUserId) ||
      !isUuid(tenantId) ||
      !isUuid(input.id) ||
      !isUuid(input.studentId) ||
      !isUuid(input.classId) ||
      (input.streamId !== null && !isUuid(input.streamId)) ||
      this.pool === null
    ) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<EnrollmentDbRow>(
            `SELECT id, tenant_id, student_id, class_id, stream_id, academic_year_id,
                    term_id, status, enrolled_at, created_at, updated_at
             FROM app.create_enrollment(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.studentId,
              input.classId,
              input.streamId,
              input.status,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapEnrollmentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'EnrollmentsRepository', error, {
        operation: 'createForTenant',
      });
      throw error;
    }
  }

  async updateStatusForTenant(
    actorUserId: string,
    tenantId: string,
    enrollmentId: string,
    status: string,
  ): Promise<EnrollmentRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(enrollmentId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<EnrollmentDbRow>(
            `SELECT id, tenant_id, student_id, class_id, stream_id, academic_year_id,
                    term_id, status, enrolled_at, created_at, updated_at
             FROM app.update_enrollment_status(
               $1::uuid, $2::uuid, $3::uuid, $4::text
             )`,
            [actorUserId, tenantId, enrollmentId, status],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapEnrollmentRow(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'EnrollmentsRepository', error, {
        operation: 'updateStatusForTenant',
      });
      throw error;
    }
  }
}

function mapEnrollmentRow(row: EnrollmentDbRow): EnrollmentRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    classId: row.class_id,
    streamId: row.stream_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    status: row.status,
    enrolledAt: row.enrolled_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
