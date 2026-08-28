/**
 * Exams, exam subjects, marks (IMP-008 / DBF-011). SELECT via RLS; writes via
 * SECURITY DEFINER helpers (app.create_exam, app.create_exam_subject,
 * app.upsert_marks, app.set_exam_subject_status).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type ExamRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly classId: string;
  readonly status: string;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ExamSubjectRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly examId: string;
  readonly subjectId: string;
  readonly maxScore: number;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MarkRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly examSubjectId: string;
  readonly studentId: string;
  readonly score: number | null;
  readonly note: string | null;
  readonly markedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ExamReportLine = {
  readonly studentId: string;
  readonly examSubjectId: string;
  readonly subjectId: string;
  readonly maxScore: number;
  readonly examSubjectStatus: string;
  readonly score: number | null;
};

type ExamDbRow = {
  id: string;
  tenant_id: string;
  name: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string;
  status: string;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type ExamSubjectDbRow = {
  id: string;
  tenant_id: string;
  exam_id: string;
  subject_id: string;
  max_score: string | number;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type MarkDbRow = {
  id: string;
  tenant_id: string;
  exam_subject_id: string;
  student_id: string;
  score: string | number | null;
  note: string | null;
  marked_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class MarksRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listExams(
    actorUserId: string,
    tenantId: string,
    query: {
      readonly limit: number;
      readonly cursor: string | undefined;
      readonly classId: string | undefined;
      readonly academicYearId: string | undefined;
      readonly status: string | undefined;
    },
  ): Promise<{ readonly rows: ReadonlyArray<ExamRow>; readonly nextCursor: string | null }> {
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
            SELECT e.id, e.tenant_id, e.name, e.academic_year_id, e.term_id, e.class_id,
                   e.status, e.created_by_user_id, e.created_at, e.updated_at
            FROM exams e
            WHERE e.tenant_id = $1::uuid`;
          if (query.classId !== undefined) {
            params.push(query.classId);
            sql += ` AND e.class_id = $${String(params.length)}::uuid`;
          }
          if (query.academicYearId !== undefined) {
            params.push(query.academicYearId);
            sql += ` AND e.academic_year_id = $${String(params.length)}::uuid`;
          }
          if (query.status !== undefined) {
            params.push(query.status);
            sql += ` AND e.status = $${String(params.length)}`;
          }
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM exams cur
                WHERE cur.id = $${String(params.length)}::uuid AND cur.tenant_id = $1::uuid
                  AND (
                    e.created_at < cur.created_at
                    OR (e.created_at = cur.created_at AND e.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY e.created_at DESC, e.id ASC LIMIT $2`;
          const result = await client.query<ExamDbRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = page.map(mapExam);
          const last = mapped[mapped.length - 1];
          return {
            rows: mapped,
            nextCursor: hasMore && last !== undefined ? last.id : null,
          };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, { operation: 'listExams' });
      return { rows: [], nextCursor: null };
    }
  }

  async getExam(actorUserId: string, tenantId: string, examId: string): Promise<ExamRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(examId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<ExamDbRow>(
            `SELECT id, tenant_id, name, academic_year_id, term_id, class_id, status,
                    created_by_user_id, created_at, updated_at
             FROM exams WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
            [tenantId, examId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapExam(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, { operation: 'getExam' });
      return null;
    }
  }

  /**
   * Tenant display name for report-card PDFs. `tenants` is member-readable
   * under RLS (app.can_see_tenant), and the read is tenant-scoped in depth.
   */
  async getTenantName(actorUserId: string, tenantId: string): Promise<string | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{ name: string }>(
            `SELECT name FROM tenants WHERE id = $1::uuid LIMIT 1`,
            [tenantId],
          );
          const row = result.rows[0];
          return row === undefined ? null : row.name;
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, { operation: 'getTenantName' });
      return null;
    }
  }

  async createExam(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly name: string;
      readonly academicYearId: string;
      readonly termId: string | null;
      readonly classId: string;
      readonly status: string;
    },
  ): Promise<ExamRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<ExamDbRow>(
        `SELECT id, tenant_id, name, academic_year_id, term_id, class_id, status,
                created_by_user_id, created_at, updated_at
         FROM app.create_exam($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, $7::uuid, $8)`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.name,
          input.academicYearId,
          input.termId,
          input.classId,
          input.status,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_exam returned no row');
      return mapExam(row);
    });
  }

  async listExamSubjects(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<ReadonlyArray<ExamSubjectRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(examId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<ExamSubjectDbRow>(
            `SELECT id, tenant_id, exam_id, subject_id, max_score, status, created_at, updated_at
             FROM exam_subjects
             WHERE tenant_id = $1::uuid AND exam_id = $2::uuid
             ORDER BY created_at ASC, id ASC`,
            [tenantId, examId],
          );
          return result.rows.map(mapExamSubject);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, {
        operation: 'listExamSubjects',
      });
      return [];
    }
  }

  async getExamSubject(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
  ): Promise<ExamSubjectRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(examSubjectId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<ExamSubjectDbRow>(
            `SELECT id, tenant_id, exam_id, subject_id, max_score, status, created_at, updated_at
             FROM exam_subjects WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
            [tenantId, examSubjectId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapExamSubject(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, {
        operation: 'getExamSubject',
      });
      return null;
    }
  }

  async createExamSubject(
    actorUserId: string,
    tenantId: string,
    input: {
      readonly id: string;
      readonly examId: string;
      readonly subjectId: string;
      readonly maxScore: number;
    },
  ): Promise<ExamSubjectRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<ExamSubjectDbRow>(
        `SELECT id, tenant_id, exam_id, subject_id, max_score, status, created_at, updated_at
         FROM app.create_exam_subject($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::numeric)`,
        [actorUserId, tenantId, input.id, input.examId, input.subjectId, input.maxScore],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_exam_subject returned no row');
      return mapExamSubject(row);
    });
  }

  async listMarks(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
  ): Promise<ReadonlyArray<MarkRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(examSubjectId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<MarkDbRow>(
            `SELECT id, tenant_id, exam_subject_id, student_id, score, note, marked_by_user_id,
                    created_at, updated_at
             FROM marks
             WHERE tenant_id = $1::uuid AND exam_subject_id = $2::uuid
             ORDER BY student_id ASC`,
            [tenantId, examSubjectId],
          );
          return result.rows.map(mapMark);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, { operation: 'listMarks' });
      return [];
    }
  }

  async upsertMarks(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    records: ReadonlyArray<{
      readonly studentId: string;
      readonly score: number | null;
      readonly note: string | null;
    }>,
  ): Promise<ReadonlyArray<MarkRow>> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      await client.query('SELECT app.upsert_marks($1::uuid, $2::uuid, $3::uuid, $4::jsonb)', [
        actorUserId,
        tenantId,
        examSubjectId,
        JSON.stringify(records),
      ]);
      const result = await client.query<MarkDbRow>(
        `SELECT id, tenant_id, exam_subject_id, student_id, score, note, marked_by_user_id,
                created_at, updated_at
         FROM marks
         WHERE tenant_id = $1::uuid AND exam_subject_id = $2::uuid
         ORDER BY student_id ASC`,
        [tenantId, examSubjectId],
      );
      return result.rows.map(mapMark);
    });
  }

  async setExamSubjectStatus(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<ExamSubjectRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<ExamSubjectDbRow>(
        `SELECT id, tenant_id, exam_id, subject_id, max_score, status, created_at, updated_at
         FROM app.set_exam_subject_status($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text)`,
        [actorUserId, tenantId, examSubjectId, fromStatus, toStatus],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('set_exam_subject_status returned no row');
      return mapExamSubject(row);
    });
  }

  /**
   * Report-card source lines (ACF-011 v1.2): approved exam subjects only —
   * draft/submitted marks must never reach a report card or its PDF.
   */
  async listReportLinesForExam(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<ReadonlyArray<ExamReportLine>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(examId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            student_id: string;
            exam_subject_id: string;
            subject_id: string;
            max_score: string | number;
            exam_subject_status: string;
            score: string | number | null;
          }>(
            `SELECT m.student_id, m.exam_subject_id, es.subject_id, es.max_score,
                    es.status AS exam_subject_status, m.score
             FROM marks m
             JOIN exam_subjects es ON es.id = m.exam_subject_id AND es.tenant_id = m.tenant_id
             WHERE m.tenant_id = $1::uuid AND es.exam_id = $2::uuid
               AND es.status = 'approved'
             ORDER BY m.student_id ASC, es.subject_id ASC`,
            [tenantId, examId],
          );
          return result.rows.map((row) => ({
            studentId: row.student_id,
            examSubjectId: row.exam_subject_id,
            subjectId: row.subject_id,
            maxScore: Number(row.max_score),
            examSubjectStatus: row.exam_subject_status,
            score: row.score === null ? null : Number(row.score),
          }));
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'MarksRepository', error, {
        operation: 'listReportLinesForExam',
      });
      return [];
    }
  }
}

function mapExam(row: ExamDbRow): ExamRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    classId: row.class_id,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapExamSubject(row: ExamSubjectDbRow): ExamSubjectRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    examId: row.exam_id,
    subjectId: row.subject_id,
    maxScore: Number(row.max_score),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapMark(row: MarkDbRow): MarkRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    examSubjectId: row.exam_subject_id,
    studentId: row.student_id,
    score: row.score === null ? null : Number(row.score),
    note: row.note,
    markedByUserId: row.marked_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
