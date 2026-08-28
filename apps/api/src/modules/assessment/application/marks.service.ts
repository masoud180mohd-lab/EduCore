/**
 * Exams / exam subjects / marks application service (IMP-008 / ACF-011).
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  IDEMPOTENCY_STORE,
  parseIdempotencyKey,
  resolveIdempotentReplay,
  type IdempotencyStore,
} from '../../../common/idempotency/index.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { ClassesService, SubjectsService } from '../../academic-structure/index.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import { StudentsService } from '../../student-registry/index.js';
import { letterGrade, percentageScore } from './letter-grade.js';
import { buildReportCardPdf } from './report-card-pdf.js';
import {
  MarksRepository,
  type ExamRow,
  type ExamSubjectRow,
  type MarkRow,
} from '../repositories/marks.repository.js';

export type Exam = ExamRow;
export type ExamSubject = ExamSubjectRow;
export type Mark = MarkRow;

export type ListExamsResult = PaginatedResponse<Exam>;
export type GetExamResult = { readonly data: Exam };
export type CreateExamResult = { readonly data: Exam };
export type ListExamSubjectsResult = { readonly data: ReadonlyArray<ExamSubject> };
export type CreateExamSubjectResult = { readonly data: ExamSubject };
export type ListMarksResult = { readonly data: ReadonlyArray<Mark> };
export type UpsertMarksResult = { readonly data: ReadonlyArray<Mark> };
export type ExamSubjectTransitionResult = { readonly data: ExamSubject };

const EXAM_STATUSES = new Set(['draft', 'open', 'closed']);
const NOTES_MAX_LEN = 500;
const MAX_SCORE_LIMIT = 9999.99;

const EXAMS_ROUTE = '/api/v1/exams';
const SUBJECTS_SUFFIX = '/subjects';
const EXAM_SUBJECTS_ROUTE_PREFIX = '/api/v1/exam-subjects/';
const MARKS_SUFFIX = '/marks';
const SUBMIT_SUFFIX = '/submit';
const APPROVE_SUFFIX = '/approve';

export type ReportCardSubjectLine = {
  readonly examSubjectId: string;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly maxScore: number;
  readonly score: number | null;
  readonly percent: number | null;
  readonly grade: string | null;
  readonly examSubjectStatus: string;
};

export type ReportCardDetail = {
  readonly studentId: string;
  readonly studentName: string;
  readonly className: string;
  readonly examId: string;
  readonly examName: string;
  readonly averagePercent: number | null;
  readonly overallGrade: string | null;
  readonly subjects: ReadonlyArray<ReportCardSubjectLine>;
};

export type ReportCardListPayload = {
  readonly exam: ExamRow;
  readonly className: string;
  readonly students: ReadonlyArray<{
    readonly studentId: string;
    readonly studentName: string;
    readonly averagePercent: number | null;
    readonly overallGrade: string | null;
  }>;
};

@Injectable()
export class MarksService {
  constructor(
    private readonly marks: MarksRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
    @Optional() private readonly students: StudentsService | null = null,
    @Optional() private readonly subjects: SubjectsService | null = null,
    @Optional() private readonly classes: ClassesService | null = null,
  ) {}

  async listExamsForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly classId?: unknown;
      readonly academicYearId?: unknown;
      readonly status?: unknown;
    },
  ): Promise<ListExamsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const pagination = parsePaginationQuery(rawQuery);
    const classId = parseOptionalUuid(rawQuery.classId, 'classId');
    const academicYearId = parseOptionalUuid(rawQuery.academicYearId, 'academicYearId');
    const status = parseExamStatusFilter(rawQuery.status);

    if (!this.marks.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.marks.listExams(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      classId,
      academicYearId,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getExamForTenant(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<GetExamResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examId)) throw AppError.notFound('Exam not found.');
    if (!this.marks.isAvailable()) throw AppError.notFound('Exam not found.');

    const row = await this.marks.getExam(actorUserId, tenantId, examId);
    if (row === null) throw AppError.notFound('Exam not found.');
    return { data: row };
  }

  async getExamSubjectForTenant(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
  ): Promise<{ readonly data: ExamSubjectRow }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examSubjectId)) throw AppError.notFound('Exam subject not found.');
    if (!this.marks.isAvailable()) throw AppError.notFound('Exam subject not found.');

    const row = await this.marks.getExamSubject(actorUserId, tenantId, examSubjectId);
    if (row === null) throw AppError.notFound('Exam subject not found.');
    return { data: row };
  }

  async createExamForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateExamResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateExamRequest(rawBody);
    const bodyJson = JSON.stringify({
      name: parsed.name,
      academicYearId: parsed.academicYearId,
      classId: parsed.classId,
      ...(parsed.termId === null ? {} : { termId: parsed.termId }),
      status: parsed.status,
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: EXAMS_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateExamResult;

      const result = await this.executeCreateExam(actorUserId, tenantId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreateExam(actorUserId, tenantId, parsed, correlationId);
  }

  async listExamSubjectsForTenant(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<ListExamSubjectsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examId)) throw AppError.notFound('Exam not found.');
    if (!this.marks.isAvailable()) throw AppError.notFound('Exam not found.');

    const exam = await this.marks.getExam(actorUserId, tenantId, examId);
    if (exam === null) throw AppError.notFound('Exam not found.');

    const rows = await this.marks.listExamSubjects(actorUserId, tenantId, examId);
    return { data: rows };
  }

  async createExamSubjectForTenant(
    actorUserId: string,
    tenantId: string,
    examId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateExamSubjectResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examId)) throw AppError.notFound('Exam not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateExamSubjectRequest(rawBody);
    const bodyJson = JSON.stringify({
      subjectId: parsed.subjectId,
      maxScore: parsed.maxScore,
    });
    const route = `${EXAMS_ROUTE}/${examId}${SUBJECTS_SUFFIX}`;

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateExamSubjectResult;

      const result = await this.executeCreateExamSubject(
        actorUserId,
        tenantId,
        examId,
        parsed,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreateExamSubject(actorUserId, tenantId, examId, parsed, correlationId);
  }

  async listMarksForTenant(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
  ): Promise<ListMarksResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examSubjectId)) throw AppError.notFound('Exam subject not found.');
    if (!this.marks.isAvailable()) throw AppError.notFound('Exam subject not found.');

    const examSubject = await this.marks.getExamSubject(actorUserId, tenantId, examSubjectId);
    if (examSubject === null) throw AppError.notFound('Exam subject not found.');

    const rows = await this.marks.listMarks(actorUserId, tenantId, examSubjectId);
    return { data: rows };
  }

  async upsertMarksForTenant(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<UpsertMarksResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examSubjectId)) throw AppError.notFound('Exam subject not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseUpsertMarksRequest(rawBody);
    const bodyJson = JSON.stringify({ records: parsed.records });
    const route = `${EXAM_SUBJECTS_ROUTE_PREFIX}${examSubjectId}${MARKS_SUFFIX}`;

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'PUT', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as UpsertMarksResult;

      const result = await this.executeUpsertMarks(
        actorUserId,
        tenantId,
        examSubjectId,
        parsed.records,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeUpsertMarks(
      actorUserId,
      tenantId,
      examSubjectId,
      parsed.records,
      correlationId,
    );
  }

  async submitExamSubjectForTenant(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<ExamSubjectTransitionResult> {
    return this.transitionExamSubject(
      actorUserId,
      tenantId,
      examSubjectId,
      'draft',
      'submitted',
      'exam_subject.submit',
      SUBMIT_SUFFIX,
      idempotencyKeyHeader,
      correlationId,
    );
  }

  async approveExamSubjectForTenant(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<ExamSubjectTransitionResult> {
    return this.transitionExamSubject(
      actorUserId,
      tenantId,
      examSubjectId,
      'submitted',
      'approved',
      'exam_subject.approve',
      APPROVE_SUFFIX,
      idempotencyKeyHeader,
      correlationId,
    );
  }

  private async transitionExamSubject(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    fromStatus: string,
    toStatus: string,
    auditAction: string,
    routeSuffix: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<ExamSubjectTransitionResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examSubjectId)) throw AppError.notFound('Exam subject not found.');

    const route = `${EXAM_SUBJECTS_ROUTE_PREFIX}${examSubjectId}${routeSuffix}`;
    const bodyJson = '{}';
    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);

    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as ExamSubjectTransitionResult;

      const result = await this.executeTransition(
        actorUserId,
        tenantId,
        examSubjectId,
        fromStatus,
        toStatus,
        auditAction,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeTransition(
      actorUserId,
      tenantId,
      examSubjectId,
      fromStatus,
      toStatus,
      auditAction,
      correlationId,
    );
  }

  private async executeCreateExam(
    actorUserId: string,
    tenantId: string,
    parsed: {
      readonly name: string;
      readonly academicYearId: string;
      readonly termId: string | null;
      readonly classId: string;
      readonly status: string;
    },
    correlationId: string,
  ): Promise<CreateExamResult> {
    if (!this.marks.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Assessment store unavailable.');
    }
    try {
      const row = await this.marks.createExam(actorUserId, tenantId, {
        id: randomUUID(),
        name: parsed.name,
        academicYearId: parsed.academicYearId,
        termId: parsed.termId,
        classId: parsed.classId,
        status: parsed.status,
      });

      await this.safeAudit({
        action: 'exam.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'exam',
        resourceId: row.id,
        metadata: { classId: parsed.classId, academicYearId: parsed.academicYearId },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapExamWriteError(error, 'Failed to create exam.');
    }
  }

  private async executeCreateExamSubject(
    actorUserId: string,
    tenantId: string,
    examId: string,
    parsed: { readonly subjectId: string; readonly maxScore: number },
    correlationId: string,
  ): Promise<CreateExamSubjectResult> {
    if (!this.marks.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Assessment store unavailable.');
    }
    try {
      const row = await this.marks.createExamSubject(actorUserId, tenantId, {
        id: randomUUID(),
        examId,
        subjectId: parsed.subjectId,
        maxScore: parsed.maxScore,
      });

      await this.safeAudit({
        action: 'exam_subject.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'exam_subject',
        resourceId: row.id,
        metadata: { examId, subjectId: parsed.subjectId },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '23505')) {
        throw new AppError('CONFLICT', 'A subject already exists for this exam.');
      }
      throw mapExamWriteError(error, 'Failed to create exam subject.');
    }
  }

  private async executeUpsertMarks(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    records: ReadonlyArray<{
      readonly studentId: string;
      readonly score: number | null;
      readonly note: string | null;
    }>,
    correlationId: string,
  ): Promise<UpsertMarksResult> {
    if (!this.marks.isAvailable()) {
      throw AppError.notFound('Exam subject not found.');
    }

    const examSubject = await this.marks.getExamSubject(actorUserId, tenantId, examSubjectId);
    if (examSubject === null) throw AppError.notFound('Exam subject not found.');
    if (examSubject.status !== 'draft') {
      throw new AppError('CONFLICT', 'Exam subject is not editable in its current status.');
    }

    try {
      const rows = await this.marks.upsertMarks(actorUserId, tenantId, examSubjectId, records);

      await this.safeAudit({
        action: 'marks.upsert',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'exam_subject',
        resourceId: examSubjectId,
        metadata: { recordCount: records.length },
      });
      return { data: rows };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '55000')) {
        throw new AppError('CONFLICT', 'Exam subject is not editable in its current status.');
      }
      if (isPgCode(error, 'P0002')) {
        throw AppError.notFound('Exam subject not found.');
      }
      if (isPgCode(error, '22023')) {
        const m = getMsg(error);
        if (m.includes('student not enrolled')) {
          throw AppError.validation(
            'One or more students are not actively enrolled in this exam class.',
            { field: 'records' },
          );
        }
        if (m.includes('score out of range')) {
          throw AppError.validation('score must be between 0 and the subject max score.', {
            field: 'score',
          });
        }
        if (m.includes('studentid')) {
          throw AppError.validation('records[].studentId must be a valid UUID.', {
            field: 'studentId',
          });
        }
        throw AppError.validation('Invalid marks payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to upsert marks.');
    }
  }

  private async executeTransition(
    actorUserId: string,
    tenantId: string,
    examSubjectId: string,
    fromStatus: string,
    toStatus: string,
    auditAction: string,
    correlationId: string,
  ): Promise<ExamSubjectTransitionResult> {
    if (!this.marks.isAvailable()) {
      throw AppError.notFound('Exam subject not found.');
    }
    try {
      const row = await this.marks.setExamSubjectStatus(
        actorUserId,
        tenantId,
        examSubjectId,
        fromStatus,
        toStatus,
      );

      await this.safeAudit({
        action: auditAction,
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'exam_subject',
        resourceId: row.id,
        metadata: { fromStatus, toStatus },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '55000')) {
        throw new AppError(
          'CONFLICT',
          `Exam subject cannot transition from ${fromStatus} to ${toStatus}.`,
        );
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update exam subject status.');
    }
  }

  private async safeAudit(input: {
    readonly action: string;
    readonly outcome: 'success' | 'failure';
    readonly correlationId: string;
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    if (this.audit === null) return;
    try {
      await this.audit.publish(input);
    } catch {
      // audit must not break the product path
    }
  }

  async listReportCardsForExam(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<{ readonly data: ReportCardListPayload }> {
    const built = await this.buildReportCards(actorUserId, tenantId, examId);
    return {
      data: {
        exam: built.exam,
        className: built.className,
        students: built.cards.map((card) => ({
          studentId: card.studentId,
          studentName: card.studentName,
          averagePercent: card.averagePercent,
          overallGrade: card.overallGrade,
        })),
      },
    };
  }

  async getReportCardForStudent(
    actorUserId: string,
    tenantId: string,
    examId: string,
    studentId: string,
  ): Promise<{ readonly data: ReportCardDetail }> {
    const built = await this.buildReportCards(actorUserId, tenantId, examId);
    const card = built.cards.find((row) => row.studentId === studentId);
    if (card === undefined) throw AppError.notFound('Report card not found.');
    return { data: card };
  }

  async getReportCardPdfForStudent(
    actorUserId: string,
    tenantId: string,
    examId: string,
    studentId: string,
  ): Promise<Buffer> {
    const { data } = await this.getReportCardForStudent(actorUserId, tenantId, examId, studentId);
    const exam = await this.getExamForTenant(actorUserId, tenantId, examId);
    // H1 fix: the school name comes from the tenant record, never a hardcoded
    // brand. Fail closed rather than printing the wrong school on a PDF.
    const schoolName = await this.marks.getTenantName(actorUserId, tenantId);
    if (schoolName === null) {
      throw new AppError('INTERNAL_ERROR', 'School profile unavailable for report card PDF.');
    }
    return buildReportCardPdf({
      schoolName,
      examName: exam.data.name,
      studentName: data.studentName,
      className: data.className,
      averagePercent: data.averagePercent === null ? '—' : String(data.averagePercent),
      lines: data.subjects.map((subject) => ({
        subject: subject.subjectName,
        score: subject.score === null ? '—' : String(subject.score),
        max: String(subject.maxScore),
        percent: subject.percent === null ? '—' : String(subject.percent),
        grade: subject.grade ?? '—',
      })),
    });
  }

  private async buildReportCards(
    actorUserId: string,
    tenantId: string,
    examId: string,
  ): Promise<{
    readonly exam: ExamRow;
    readonly className: string;
    readonly cards: ReadonlyArray<ReportCardDetail>;
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(examId)) throw AppError.notFound('Exam not found.');
    if (!this.marks.isAvailable()) throw AppError.notFound('Exam not found.');
    const exam = await this.marks.getExam(actorUserId, tenantId, examId);
    if (exam === null) throw AppError.notFound('Exam not found.');
    const allLines = await this.marks.listReportLinesForExam(actorUserId, tenantId, examId);
    // ACF-011 v1.2: report cards compose approved exam subjects only. The
    // repository query filters in SQL; this guards the invariant in depth.
    const lines = allLines.filter((line) => line.examSubjectStatus === 'approved');
    const studentIds = [...new Set(lines.map((line) => line.studentId))];
    const subjectIds = [...new Set(lines.map((line) => line.subjectId))];
    const studentNames = new Map<string, string>();
    const subjectNames = new Map<string, string>();
    let className = exam.classId;
    if (this.students !== null) {
      for (const id of studentIds) {
        try {
          const row = await this.students.getForTenant(actorUserId, tenantId, id);
          studentNames.set(id, row.data.displayName);
        } catch {
          studentNames.set(id, id);
        }
      }
    }
    if (this.subjects !== null) {
      for (const id of subjectIds) {
        try {
          const row = await this.subjects.getForTenant(actorUserId, tenantId, id);
          subjectNames.set(id, row.data.name);
        } catch {
          subjectNames.set(id, id);
        }
      }
    }
    if (this.classes !== null) {
      try {
        const row = await this.classes.getForTenant(actorUserId, tenantId, exam.classId);
        className = row.data.name;
      } catch {
        className = exam.classId;
      }
    }
    const byStudent = new Map<string, ReportCardSubjectLine[]>();
    for (const line of lines) {
      const percent = percentageScore(line.score, line.maxScore);
      const subjects = byStudent.get(line.studentId) ?? [];
      subjects.push({
        examSubjectId: line.examSubjectId,
        subjectId: line.subjectId,
        subjectName: subjectNames.get(line.subjectId) ?? line.subjectId,
        maxScore: line.maxScore,
        score: line.score,
        percent,
        grade: letterGrade(percent),
        examSubjectStatus: line.examSubjectStatus,
      });
      byStudent.set(line.studentId, subjects);
    }
    const cards: ReportCardDetail[] = [];
    for (const studentId of studentIds) {
      const subjects = byStudent.get(studentId) ?? [];
      const percents = subjects.map((s) => s.percent).filter((p): p is number => p !== null);
      const averagePercent =
        percents.length === 0
          ? null
          : Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10;
      cards.push({
        studentId,
        studentName: studentNames.get(studentId) ?? studentId,
        className,
        examId: exam.id,
        examName: exam.name,
        averagePercent,
        overallGrade: letterGrade(averagePercent),
        subjects,
      });
    }
    return { exam, className, cards };
  }
}

function mapExamWriteError(error: unknown, fallbackMessage: string): AppError {
  if (isPgCode(error, '23505')) {
    return new AppError('CONFLICT', 'A conflicting record already exists.');
  }
  if (isPgCode(error, '22023')) {
    const m = getMsg(error);
    if (m.includes('academic year not found')) {
      return AppError.validation('academicYearId not found in this tenant.', {
        field: 'academicYearId',
      });
    }
    if (m.includes('class not found')) {
      return AppError.validation('classId not found in this tenant.', { field: 'classId' });
    }
    if (m.includes('term not found')) {
      return AppError.validation('termId not found in this tenant.', { field: 'termId' });
    }
    if (m.includes('subject not found')) {
      return AppError.validation('subjectId not found in this tenant.', { field: 'subjectId' });
    }
    if (m.includes('exam not found')) {
      return AppError.validation('Exam not found in this tenant.', { field: 'examId' });
    }
    return AppError.validation('Invalid payload.');
  }
  return new AppError('INTERNAL_ERROR', fallbackMessage);
}

function parseExamStatusFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !EXAM_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, open, or closed.', { field: 'status' });
  }
  return raw;
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function parseCreateExamRequest(raw: unknown): {
  readonly name: string;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly classId: string;
  readonly status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'academicYearId', 'classId', 'termId', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['name'] !== 'string') {
    throw AppError.validation('name is required.', { field: 'name' });
  }
  const name = body['name'].trim();
  if (name.length < 1 || name.length > 200) {
    throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
  }
  if (typeof body['academicYearId'] !== 'string' || !isUuid(body['academicYearId'])) {
    throw AppError.validation('academicYearId is required and must be a UUID.', {
      field: 'academicYearId',
    });
  }
  if (typeof body['classId'] !== 'string' || !isUuid(body['classId'])) {
    throw AppError.validation('classId is required and must be a UUID.', { field: 'classId' });
  }
  let termId: string | null = null;
  if (body['termId'] !== undefined && body['termId'] !== null && body['termId'] !== '') {
    if (typeof body['termId'] !== 'string' || !isUuid(body['termId'])) {
      throw AppError.validation('termId must be a UUID.', { field: 'termId' });
    }
    termId = body['termId'];
  }
  let status = 'open';
  if (body['status'] !== undefined) {
    if (typeof body['status'] !== 'string' || !EXAM_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, open, or closed.', { field: 'status' });
    }
    status = body['status'];
  }
  return {
    name,
    academicYearId: body['academicYearId'],
    termId,
    classId: body['classId'],
    status,
  };
}

function parseCreateExamSubjectRequest(raw: unknown): {
  readonly subjectId: string;
  readonly maxScore: number;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['subjectId', 'maxScore']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['subjectId'] !== 'string' || !isUuid(body['subjectId'])) {
    throw AppError.validation('subjectId is required and must be a UUID.', {
      field: 'subjectId',
    });
  }
  if (typeof body['maxScore'] !== 'number' || !Number.isFinite(body['maxScore'])) {
    throw AppError.validation('maxScore is required and must be a number.', {
      field: 'maxScore',
    });
  }
  if (body['maxScore'] <= 0 || body['maxScore'] > MAX_SCORE_LIMIT) {
    throw AppError.validation(
      `maxScore must be greater than 0 and at most ${String(MAX_SCORE_LIMIT)}.`,
      {
        field: 'maxScore',
      },
    );
  }
  return { subjectId: body['subjectId'], maxScore: body['maxScore'] };
}

function parseUpsertMarksRequest(raw: unknown): {
  readonly records: ReadonlyArray<{
    readonly studentId: string;
    readonly score: number | null;
    readonly note: string | null;
  }>;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'records') {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (!Array.isArray(body['records'])) {
    throw AppError.validation('records is required and must be an array.', { field: 'records' });
  }
  if (body['records'].length === 0) {
    throw AppError.validation('records must contain at least one item.', { field: 'records' });
  }
  const records = body['records'].map((item, index) => parseMarkRecordItem(item, index));
  return { records };
}

function parseMarkRecordItem(
  raw: unknown,
  index: number,
): {
  readonly studentId: string;
  readonly score: number | null;
  readonly note: string | null;
} {
  const prefix = `records[${String(index)}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation(`${prefix} must be an object.`, { field: 'records' });
  }
  const item = raw as Record<string, unknown>;
  for (const key of Object.keys(item)) {
    if (!['studentId', 'score', 'note'].includes(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof item['studentId'] !== 'string' || !isUuid(item['studentId'])) {
    throw AppError.validation(`${prefix}.studentId must be a UUID.`, { field: 'studentId' });
  }
  let score: number | null = null;
  if (item['score'] !== undefined && item['score'] !== null) {
    if (typeof item['score'] !== 'number' || !Number.isFinite(item['score'])) {
      throw AppError.validation(`${prefix}.score must be a number.`, { field: 'score' });
    }
    if (item['score'] < 0) {
      throw AppError.validation(`${prefix}.score must be zero or greater.`, { field: 'score' });
    }
    score = item['score'];
  }
  let note: string | null = null;
  if (item['note'] !== undefined && item['note'] !== null) {
    if (typeof item['note'] !== 'string') {
      throw AppError.validation(`${prefix}.note must be a string.`, { field: 'note' });
    }
    const trimmed = item['note'].trim();
    if (trimmed.length > NOTES_MAX_LEN) {
      throw AppError.validation(`note must be at most ${String(NOTES_MAX_LEN)} characters.`, {
        field: 'note',
      });
    }
    note = trimmed === '' ? null : trimmed;
  }
  return { studentId: item['studentId'], score, note };
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

function getMsg(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'object' && error !== null) {
    const m = (error as Record<string, unknown>)['message'];
    if (typeof m === 'string') return m.toLowerCase();
  }
  return String(error).toLowerCase();
}
