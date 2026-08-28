import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { MarksService } from './marks.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const examId = '01900000-0000-7000-8000-0000000000e1';
const classId = '01900000-0000-7000-8000-0000000000c1';
const academicYearId = '01900000-0000-7000-8000-0000000000a2';
const examSubjectId = '01900000-0000-7000-8000-0000000000f1';
const subjectId = '01900000-0000-7000-8000-0000000000b1';
const idempotencyKey = '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d';

function makeService(repo: Record<string, unknown>): MarksService {
  return new MarksService(repo as never, null, null);
}

describe('MarksService', () => {
  it('returns empty page when store unavailable', async () => {
    const service = makeService({ isAvailable: () => false });
    const result = await service.listExamsForTenant(actorUserId, tenantId, {});
    expect(result.data).toEqual([]);
    expect(result.page.limit).toBe(25);
  });

  it('returns 404 for unknown exam', async () => {
    const service = makeService({
      isAvailable: () => true,
      getExam: vi.fn().mockResolvedValue(null),
    });
    await expect(service.getExamForTenant(actorUserId, tenantId, examId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 for unknown exam subject', async () => {
    const service = makeService({
      isAvailable: () => true,
      getExamSubject: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.getExamSubjectForTenant(actorUserId, tenantId, examSubjectId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects exam create without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createExamForTenant(
        actorUserId,
        tenantId,
        { name: 'Midterm', academicYearId, classId },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects exam subject create without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createExamSubjectForTenant(
        actorUserId,
        tenantId,
        examId,
        { subjectId, maxScore: 100 },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects marks upsert without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.upsertMarksForTenant(
        actorUserId,
        tenantId,
        examSubjectId,
        { records: [{ studentId: actorUserId, score: 90 }] },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects empty records array on marks upsert', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.upsertMarksForTenant(
        actorUserId,
        tenantId,
        examSubjectId,
        { records: [] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects marks upsert when exam subject is not in draft status', async () => {
    const service = makeService({
      isAvailable: () => true,
      getExamSubject: vi.fn().mockResolvedValue({ id: examSubjectId, status: 'submitted' }),
    });
    await expect(
      service.upsertMarksForTenant(
        actorUserId,
        tenantId,
        examSubjectId,
        { records: [{ studentId: actorUserId, score: 90 }] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps invalid status transition to conflict on submit', async () => {
    const service = makeService({
      isAvailable: () => true,
      setExamSubjectStatus: vi.fn().mockRejectedValue({ code: '55000' }),
    });
    await expect(
      service.submitExamSubjectForTenant(actorUserId, tenantId, examSubjectId, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps invalid status transition to conflict on approve', async () => {
    const service = makeService({
      isAvailable: () => true,
      setExamSubjectStatus: vi.fn().mockRejectedValue({ code: '55000' }),
    });
    await expect(
      service.approveExamSubjectForTenant(actorUserId, tenantId, examSubjectId, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('calls setExamSubjectStatus with submitted->approved on approve', async () => {
    const setExamSubjectStatus = vi.fn().mockResolvedValue({
      id: examSubjectId,
      status: 'approved',
    });
    const service = makeService({ isAvailable: () => true, setExamSubjectStatus });
    await service.approveExamSubjectForTenant(
      actorUserId,
      tenantId,
      examSubjectId,
      undefined,
      'corr',
    );
    expect(setExamSubjectStatus).toHaveBeenCalledWith(
      actorUserId,
      tenantId,
      examSubjectId,
      'submitted',
      'approved',
    );
  });

  it('maps duplicate exam subject to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      createExamSubject: vi.fn().mockRejectedValue({ code: '23505' }),
    });
    await expect(
      service.createExamSubjectForTenant(
        actorUserId,
        tenantId,
        examId,
        { subjectId, maxScore: 100 },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps class not found on exam create', async () => {
    const service = makeService({
      isAvailable: () => true,
      createExam: vi.fn().mockRejectedValue({ code: '22023', message: 'class not found' }),
    });
    await expect(
      service.createExamForTenant(
        actorUserId,
        tenantId,
        { name: 'Midterm', academicYearId, classId },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(service.listExamsForTenant('bad', tenantId, {})).rejects.toBeInstanceOf(AppError);
  });

  it('validates maxScore on exam subject create', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createExamSubjectForTenant(
        actorUserId,
        tenantId,
        examId,
        { subjectId, maxScore: -5 },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('composes derived report-card grades without storing them', async () => {
    const studentId = '01900000-0000-7000-8000-0000000000s1';
    const service = makeService({
      isAvailable: () => true,
      getExam: vi.fn().mockResolvedValue({
        id: examId,
        name: 'Midterm',
        classId,
        academicYearId,
        status: 'open',
      }),
      listReportLinesForExam: vi.fn().mockResolvedValue([
        {
          studentId,
          examSubjectId,
          subjectId,
          maxScore: 100,
          examSubjectStatus: 'approved',
          score: 81,
        },
      ]),
    });
    const result = await service.listReportCardsForExam(actorUserId, tenantId, examId);
    expect(result.data.students).toHaveLength(1);
    expect(result.data.students[0]?.overallGrade).toBe('A');
    expect(result.data.students[0]?.averagePercent).toBe(81);
  });

  it('composes report cards from approved exam subjects only (ACF-011 v1.2)', async () => {
    const studentApproved = '01900000-0000-7000-8000-0000000000s1';
    const studentDraftOnly = '01900000-0000-7000-8000-0000000000s2';
    const draftSubjectId = '01900000-0000-7000-8000-0000000000b2';
    const service = makeService({
      isAvailable: () => true,
      getExam: vi.fn().mockResolvedValue({
        id: examId,
        name: 'Midterm',
        classId,
        academicYearId,
        status: 'open',
      }),
      listReportLinesForExam: vi.fn().mockResolvedValue([
        {
          studentId: studentApproved,
          examSubjectId,
          subjectId,
          maxScore: 100,
          examSubjectStatus: 'approved',
          score: 72,
        },
        {
          studentId: studentApproved,
          examSubjectId: '01900000-0000-7000-8000-0000000000f2',
          subjectId: draftSubjectId,
          maxScore: 100,
          examSubjectStatus: 'draft',
          score: 99,
        },
        {
          studentId: studentDraftOnly,
          examSubjectId: '01900000-0000-7000-8000-0000000000f3',
          subjectId: draftSubjectId,
          maxScore: 100,
          examSubjectStatus: 'submitted',
          score: 95,
        },
      ]),
    });

    const result = await service.listReportCardsForExam(actorUserId, tenantId, examId);

    expect(result.data.students).toHaveLength(1);
    const card = result.data.students[0];
    expect(card?.studentId).toBe(studentApproved);
    expect(card?.averagePercent).toBe(72);
    expect(card?.overallGrade).toBe('B');
    const detail = await service.getReportCardForStudent(
      actorUserId,
      tenantId,
      examId,
      studentApproved,
    );
    expect(detail.data.subjects.map((line) => line.examSubjectStatus)).toEqual(['approved']);
    await expect(
      service.getReportCardForStudent(actorUserId, tenantId, examId, studentDraftOnly),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('renders report card PDF with the real tenant school name, not a hardcoded brand', async () => {
    const studentId = '01900000-0000-7000-8000-0000000000s1';
    const service = makeService({
      isAvailable: () => true,
      getExam: vi.fn().mockResolvedValue({
        id: examId,
        name: 'Midterm',
        classId,
        academicYearId,
        status: 'open',
      }),
      listReportLinesForExam: vi.fn().mockResolvedValue([
        {
          studentId,
          examSubjectId,
          subjectId,
          maxScore: 100,
          examSubjectStatus: 'approved',
          score: 81,
        },
      ]),
      getTenantName: vi.fn().mockResolvedValue('Shule ya Papa Mwamba'),
    });

    const pdf = await service.getReportCardPdfForStudent(actorUserId, tenantId, examId, studentId);

    // PDF streams are uncompressed here, so the text is inspectable.
    const text = pdf.toString('latin1');
    expect(text).toContain('Shule ya Papa Mwamba');
    expect(text).toContain('REPORT CARD');
    expect(text).not.toContain('EduCore');
  });

  it('fails closed when the tenant school name is unavailable for the PDF', async () => {
    const studentId = '01900000-0000-7000-8000-0000000000s1';
    const service = makeService({
      isAvailable: () => true,
      getExam: vi.fn().mockResolvedValue({
        id: examId,
        name: 'Midterm',
        classId,
        academicYearId,
        status: 'open',
      }),
      listReportLinesForExam: vi.fn().mockResolvedValue([
        {
          studentId,
          examSubjectId,
          subjectId,
          maxScore: 100,
          examSubjectStatus: 'approved',
          score: 81,
        },
      ]),
      getTenantName: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.getReportCardPdfForStudent(actorUserId, tenantId, examId, studentId),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
