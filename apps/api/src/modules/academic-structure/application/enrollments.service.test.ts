import { describe, expect, it, vi } from 'vitest';

import { EnrollmentsService } from './enrollments.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const studentId = '01900000-0000-7000-8000-0000000000b1';
const classId = '01900000-0000-7000-8000-0000000000e1';
const enrollmentA = {
  id: '01900000-0000-7000-8000-0000000000a1',
  tenantId,
  studentId,
  classId,
  streamId: null,
  academicYearId: '01900000-0000-7000-8000-0000000000c1',
  termId: null,
  status: 'active',
  enrolledAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EnrollmentsService', () => {
  it('lists enrollments', async () => {
    const enrollments = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [enrollmentA], nextCursor: null }),
    };
    const service = new EnrollmentsService(enrollments as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toMatchObject({
      data: [enrollmentA],
    });
  });

  it('rejects non-uuid studentId filter', async () => {
    const enrollments = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new EnrollmentsService(enrollments as never);
    await expect(
      service.listForTenant(actorId, tenantId, { studentId: 'bad' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('get maps missing to 404', async () => {
    const enrollments = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new EnrollmentsService(enrollments as never);
    await expect(service.getForTenant(actorId, tenantId, enrollmentA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('create requires Idempotency-Key', async () => {
    const enrollments = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new EnrollmentsService(enrollments as never);
    await expect(
      service.createForTenant(actorId, tenantId, { studentId, classId }, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('maps student not found to VALIDATION_ERROR', async () => {
    const enrollments = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue({
        code: '22023',
        message: 'student not found',
      }),
    };
    const service = new EnrollmentsService(enrollments as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { studentId, classId },
        'idem-key-enrollment-create01',
        'c',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('patch status requires status field', async () => {
    const enrollments = { isAvailable: () => true, updateStatusForTenant: vi.fn() };
    const service = new EnrollmentsService(enrollments as never);
    await expect(
      service.patchForTenant(actorId, tenantId, enrollmentA.id, {}, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('patch updates status', async () => {
    const updated = { ...enrollmentA, status: 'withdrawn' };
    const enrollments = {
      isAvailable: () => true,
      updateStatusForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = new EnrollmentsService(enrollments as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        enrollmentA.id,
        { status: 'withdrawn' },
        undefined,
        'c',
      ),
    ).resolves.toEqual({ data: updated });
  });
});
