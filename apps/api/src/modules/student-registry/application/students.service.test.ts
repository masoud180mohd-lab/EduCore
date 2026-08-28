import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
import { StudentsService } from './students.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const studentA = {
  id: '01900000-0000-7000-8000-0000000000b1',
  tenantId,
  studentCode: 'STU-001',
  displayName: 'Asha Juma',
  status: 'active',
  userId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('StudentsService.listForTenant', () => {
  it('returns paginated students from repository', async () => {
    const students = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [studentA], nextCursor: null }),
    };
    const service = new StudentsService(students as never);
    const result = await service.listForTenant(actorId, tenantId, {});
    expect(result).toEqual({
      data: [studentA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(students.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const students = { isAvailable: () => false, listForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(students.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid status', async () => {
    const students = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(
      service.listForTenant(actorId, tenantId, { status: 'enrolled' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('passes pagination, status, and escaped search', async () => {
    const students = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new StudentsService(students as never);
    await service.listForTenant(actorId, tenantId, {
      limit: '10',
      cursor: studentA.id,
      status: 'active',
      search: 'a%b_c',
    });
    expect(students.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 10,
      cursor: studentA.id,
      status: 'active',
      search: 'a\\%b\\_c',
    });
  });

  it('rejects non-uuid actor', async () => {
    const students = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('StudentsService.getForTenant', () => {
  it('returns student envelope when repository finds row', async () => {
    const students = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(studentA),
    };
    const service = new StudentsService(students as never);
    await expect(service.getForTenant(actorId, tenantId, studentA.id)).resolves.toEqual({
      data: studentA,
    });
    expect(students.getByIdForTenant).toHaveBeenCalledWith(actorId, tenantId, studentA.id);
  });

  it('returns 404 when student not visible (missing or cross-tenant)', async () => {
    const students = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new StudentsService(students as never);
    await expect(service.getForTenant(actorId, tenantId, studentA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns 404 for invalid target UUID without calling repository', async () => {
    const students = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn(),
    };
    const service = new StudentsService(students as never);
    await expect(service.getForTenant(actorId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(students.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('returns 404 when pool unavailable (no existence leak)', async () => {
    const students = {
      isAvailable: () => false,
      getByIdForTenant: vi.fn(),
    };
    const service = new StudentsService(students as never);
    await expect(service.getForTenant(actorId, tenantId, studentA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(students.getByIdForTenant).not.toHaveBeenCalled();
  });
});

describe('StudentsService.createForTenant', () => {
  const corr = 'corr-stu-1';

  it('requires Idempotency-Key', async () => {
    const students = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(
      service.createForTenant(actorId, tenantId, { displayName: 'Asha' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('creates student and audits success', async () => {
    const students = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(studentA),
    };
    const audit = new InMemoryAuditPublisher();
    const store = new InMemoryIdempotencyStore();
    const service = new StudentsService(students as never, store, audit);
    const key = 'idem-key-student-create-01';
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { displayName: 'Asha Juma', studentCode: 'STU-001' },
        key,
        corr,
      ),
    ).resolves.toEqual({ data: studentA });
    expect(students.createForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      expect.objectContaining({
        displayName: 'Asha Juma',
        studentCode: 'STU-001',
        status: 'active',
      }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'student.create',
      outcome: 'success',
      resourceId: studentA.id,
    });
  });

  it('replays identical idempotent create', async () => {
    const students = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(studentA),
    };
    const store = new InMemoryIdempotencyStore();
    const service = new StudentsService(students as never, store);
    const key = 'idem-key-student-create-02';
    const body = { displayName: 'Asha Juma' };
    const first = await service.createForTenant(actorId, tenantId, body, key, corr);
    const second = await service.createForTenant(actorId, tenantId, body, key, corr);
    expect(first).toEqual(second);
    expect(students.createForTenant).toHaveBeenCalledOnce();
  });

  it('maps unique violation to CONFLICT', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    const students = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue(err),
    };
    const service = new StudentsService(students as never, new InMemoryIdempotencyStore());
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { displayName: 'X', studentCode: 'DUP' },
        'idem-key-student-create-03',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects missing displayName', async () => {
    const students = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { studentCode: 'STU-1' },
        'idem-key-student-create-04',
        corr,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('StudentsService.patchForTenant', () => {
  const corr = 'corr-stu-patch';

  it('patches status and audits fields', async () => {
    const updated = { ...studentA, status: 'inactive' };
    const students = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new StudentsService(students as never, null, audit);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        studentA.id,
        { status: 'inactive' },
        undefined,
        corr,
      ),
    ).resolves.toEqual({ data: updated });
    expect(students.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      studentA.id,
      expect.objectContaining({
        setStatus: true,
        status: 'inactive',
        setDisplayName: false,
        setStudentCode: false,
      }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'student.patch',
      metadata: { fields: ['status'] },
    });
  });

  it('maps missing student to 404', async () => {
    const students = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new StudentsService(students as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        studentA.id,
        { status: 'inactive' },
        undefined,
        corr,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects empty body', async () => {
    const students = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(
      service.patchForTenant(actorId, tenantId, studentA.id, {}, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(students.updateForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid id without repo call', async () => {
    const students = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new StudentsService(students as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        'not-a-uuid',
        { status: 'active' },
        undefined,
        corr,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(students.updateForTenant).not.toHaveBeenCalled();
  });

  it('maps unique violation to CONFLICT', async () => {
    const students = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockRejectedValue({ code: '23505', message: 'dup' }),
    };
    const service = new StudentsService(students as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        studentA.id,
        { studentCode: 'DUP' },
        undefined,
        corr,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
