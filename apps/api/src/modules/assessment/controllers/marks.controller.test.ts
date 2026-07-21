import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { MarksController } from './marks.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const examId = '01900000-0000-7000-8000-0000000000e1';

describe('MarksController', () => {
  it('lists exams for authenticated principal', async () => {
    const marksService = {
      listExamsForTenant: vi.fn().mockResolvedValue({
        data: [{ id: examId, name: 'Midterm', status: 'open' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new MarksController(marksService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.listExams(request as never);
    expect(marksService.listExamsForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      classId: undefined,
      academicYearId: undefined,
      status: undefined,
    });
    expect(result).toMatchObject({
      data: [{ id: examId, name: 'Midterm' }],
    });
  });

  it('creates exam with idempotency header', async () => {
    const marksService = {
      createExamForTenant: vi.fn().mockResolvedValue({
        data: { id: examId, name: 'Midterm' },
      }),
    };
    const controller = new MarksController(marksService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.createExam(request as never, { name: 'Midterm' }, 'idem-1');
    expect(marksService.createExamForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { name: 'Midterm' },
      'idem-1',
      'unknown',
    );
  });

  it('rejects list without auth', async () => {
    const marksService = { listExamsForTenant: vi.fn() };
    const controller = new MarksController(marksService as never);
    await expect(
      controller.listExams({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('gets exam subject for authenticated principal', async () => {
    const examSubjectId = '01900000-0000-7000-8000-0000000000f1';
    const marksService = {
      getExamSubjectForTenant: vi.fn().mockResolvedValue({
        data: { id: examSubjectId, examId, status: 'draft' },
      }),
    };
    const controller = new MarksController(marksService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getExamSubject(request as never, examSubjectId);
    expect(marksService.getExamSubjectForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      examSubjectId,
    );
    expect(result).toMatchObject({ data: { id: examSubjectId } });
  });
});
