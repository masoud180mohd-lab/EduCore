/**
 * Attendance sessions + records (DBF-009). SELECT via RLS; writes via helpers.
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type AttendanceSessionRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly classId: string;
  readonly streamId: string | null;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly sessionDate: string;
  readonly status: string;
  readonly notes: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AttendanceRecordRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly studentId: string;
  readonly status: string;
  readonly note: string | null;
  readonly markedAt: string;
  readonly markedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

@Injectable()
export class AttendanceSessionsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listSessions(
    actorUserId: string,
    tenantId: string,
    query: {
      limit: number;
      cursor: string | undefined;
      classId: string | undefined;
      sessionDate: string | undefined;
      status: 'open' | 'closed' | undefined;
    },
  ): Promise<{ rows: AttendanceSessionRow[]; nextCursor: string | null }> {
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
            SELECT s.id, s.tenant_id, s.class_id, s.stream_id, s.academic_year_id, s.term_id,
                   s.session_date, s.status, s.notes, s.created_by_user_id, s.created_at, s.updated_at
            FROM attendance_sessions s
            WHERE s.tenant_id = $1::uuid`;
          if (query.classId !== undefined) {
            params.push(query.classId);
            sql += ` AND s.class_id = $${String(params.length)}::uuid`;
          }
          if (query.sessionDate !== undefined) {
            params.push(query.sessionDate);
            sql += ` AND s.session_date = $${String(params.length)}::date`;
          }
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND s.status = $${String(params.length)}`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM attendance_sessions cur
                WHERE cur.id = $${String(params.length)}::uuid AND cur.tenant_id = $1::uuid
                  AND (
                    s.session_date < cur.session_date
                    OR (s.session_date = cur.session_date AND s.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY s.session_date DESC, s.id ASC LIMIT $2`;
          const result = await client.query(sql, params);
          const hasMore = result.rows.length > query.limit;
          const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = page.map(mapSession);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'listSessions',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async getSession(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<AttendanceSessionRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(sessionId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query(
            `SELECT s.id, s.tenant_id, s.class_id, s.stream_id, s.academic_year_id, s.term_id,
                    s.session_date, s.status, s.notes, s.created_by_user_id, s.created_at, s.updated_at
             FROM attendance_sessions s
             WHERE s.tenant_id = $1::uuid AND s.id = $2::uuid LIMIT 1`,
            [tenantId, sessionId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapSession(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'getSession',
      });
      return null;
    }
  }

  async createSession(
    actorUserId: string,
    tenantId: string,
    input: {
      id: string;
      classId: string;
      streamId: string | null;
      sessionDate: string;
      notes: string | null;
    },
  ): Promise<AttendanceSessionRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return null;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query(
            `SELECT id, tenant_id, class_id, stream_id, academic_year_id, term_id,
                    session_date, status, notes, created_by_user_id, created_at, updated_at
             FROM app.create_attendance_session(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::date, $7::text
             )`,
            [
              actorUserId,
              tenantId,
              input.id,
              input.classId,
              input.streamId,
              input.sessionDate,
              input.notes,
            ],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapSession(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'createSession',
      });
      throw error;
    }
  }

  async closeSession(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<AttendanceSessionRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(sessionId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query(
            `SELECT id, tenant_id, class_id, stream_id, academic_year_id, term_id,
                    session_date, status, notes, created_by_user_id, created_at, updated_at
             FROM app.close_attendance_session($1::uuid, $2::uuid, $3::uuid)`,
            [actorUserId, tenantId, sessionId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapSession(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'closeSession',
      });
      throw error;
    }
  }

  async listRecords(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<AttendanceRecordRow[]> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(sessionId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query(
            `SELECT r.id, r.tenant_id, r.session_id, r.student_id, r.status, r.note,
                    r.marked_at, r.marked_by_user_id, r.created_at, r.updated_at
             FROM attendance_records r
             WHERE r.tenant_id = $1::uuid AND r.session_id = $2::uuid
             ORDER BY r.student_id ASC`,
            [tenantId, sessionId],
          );
          return result.rows.map(mapRecord);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'listRecords',
      });
      return [];
    }
  }

  async upsertRecords(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
    records: ReadonlyArray<{ studentId: string; status: string; note: string | null }>,
  ): Promise<AttendanceRecordRow[]> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(sessionId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const out: AttendanceRecordRow[] = [];
          for (const rec of records) {
            const result = await client.query(
              `SELECT id, tenant_id, session_id, student_id, status, note,
                      marked_at, marked_by_user_id, created_at, updated_at
               FROM app.upsert_attendance_record(
                 $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::text, $7::text
               )`,
              [
                actorUserId,
                tenantId,
                randomUUID(),
                sessionId,
                rec.studentId,
                rec.status,
                rec.note,
              ],
            );
            const row = result.rows[0];
            if (row !== undefined) out.push(mapRecord(row));
          }
          return out;
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'AttendanceSessionsRepository', error, {
        operation: 'upsertRecords',
      });
      throw error;
    }
  }
}

function formatDate(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

function mapSession(row: Record<string, unknown>): AttendanceSessionRow {
  return {
    id: String(row['id']),
    tenantId: String(row['tenant_id']),
    classId: String(row['class_id']),
    streamId: row['stream_id'] === null || row['stream_id'] === undefined ? null : String(row['stream_id']),
    academicYearId: String(row['academic_year_id']),
    termId: row['term_id'] === null || row['term_id'] === undefined ? null : String(row['term_id']),
    sessionDate: formatDate(row['session_date'] as Date | string),
    status: String(row['status']),
    notes: row['notes'] === null || row['notes'] === undefined ? null : String(row['notes']),
    createdByUserId:
      row['created_by_user_id'] === null || row['created_by_user_id'] === undefined
        ? null
        : String(row['created_by_user_id']),
    createdAt: new Date(row['created_at'] as Date).toISOString(),
    updatedAt: new Date(row['updated_at'] as Date).toISOString(),
  };
}

function mapRecord(row: Record<string, unknown>): AttendanceRecordRow {
  return {
    id: String(row['id']),
    tenantId: String(row['tenant_id']),
    sessionId: String(row['session_id']),
    studentId: String(row['student_id']),
    status: String(row['status']),
    note: row['note'] === null || row['note'] === undefined ? null : String(row['note']),
    markedAt: new Date(row['marked_at'] as Date).toISOString(),
    markedByUserId:
      row['marked_by_user_id'] === null || row['marked_by_user_id'] === undefined
        ? null
        : String(row['marked_by_user_id']),
    createdAt: new Date(row['created_at'] as Date).toISOString(),
    updatedAt: new Date(row['updated_at'] as Date).toISOString(),
  };
}
