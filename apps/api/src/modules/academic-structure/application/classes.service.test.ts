import { describe, expect, it, vi } from 'vitest';

import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
import { ClassesService } from './classes.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';
const classA = {
  id: '01900000-0000-7000-8000-0000000000e1',
  tenantId,
  academicYearId: yearId,
  termId: null,
  name: 'Form 1A',
  code: 'F1A',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ClassesService.listForTenant', () => {
  it('returns paginated classes', async () => {
    const classes = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [classA], nextCursor: null }),
    };
    const service = new ClassesService(classes as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [classA],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('rejects non-uuid academicYearId', async () => {
    const classes = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(
      service.listForTenant(actorId, tenantId, { academicYearId: 'bad' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects non-uuid termId', async () => {
    const classes = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(service.listForTenant(actorId, tenantId, { termId: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns empty when pool unavailable', async () => {
    const classes = { isAvailable: () => false, listForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
  });
});

describe('ClassesService.getForTenant', () => {
  it('returns envelope when found', async () => {
    const classes = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(classA),
    };
    const service = new ClassesService(classes as never);
    await expect(service.getForTenant(actorId, tenantId, classA.id)).resolves.toEqual({
      data: classA,
    });
  });

  it('maps missing to 404', async () => {
    const classes = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new ClassesService(classes as never);
    await expect(service.getForTenant(actorId, tenantId, classA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('ClassesService.createForTenant', () => {
  it('requires Idempotency-Key', async () => {
    const classes = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'Form 1A' },
        undefined,
        'c',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('maps parent year miss to VALIDATION_ERROR', async () => {
    const classes = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue({
        code: '22023',
        message: 'parent academic year not found',
      }),
    };
    const service = new ClassesService(classes as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'Form 1A' },
        'idem-key-class-create01',
        'c',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('ClassesService.patchForTenant', () => {
  it('patches status', async () => {
    const updated = { ...classA, status: 'closed' };
    const classes = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(actorId, tenantId, classA.id, { status: 'closed' }, undefined, 'c'),
    ).resolves.toEqual({ data: updated });
    expect(classes.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      classA.id,
      expect.objectContaining({ setStatus: true, status: 'closed' }),
    );
  });

  it('rejects empty body', async () => {
    const classes = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(actorId, tenantId, classA.id, {}, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(classes.updateForTenant).not.toHaveBeenCalled();
  });

  it('maps missing class to 404', async () => {
    const classes = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(actorId, tenantId, classA.id, { status: 'active' }, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reparents to another academic year and term, passing flags to repo', async () => {
    const newYearId = '01900000-0000-7000-8000-0000000000c9';
    const newTermId = '01900000-0000-7000-8000-0000000000d9';
    const updated = { ...classA, academicYearId: newYearId, termId: newTermId };
    const classes = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        classA.id,
        { academicYearId: newYearId, termId: newTermId },
        undefined,
        'c',
      ),
    ).resolves.toEqual({ data: updated });
    expect(classes.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      classA.id,
      expect.objectContaining({
        setAcademicYearId: true,
        academicYearId: newYearId,
        setTermId: true,
        termId: newTermId,
      }),
    );
  });

  it('clears termId when set to null', async () => {
    const updated = { ...classA, termId: null };
    const classes = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(actorId, tenantId, classA.id, { termId: null }, undefined, 'c'),
    ).resolves.toEqual({ data: updated });
    expect(classes.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      classA.id,
      expect.objectContaining({ setTermId: true, termId: null }),
    );
  });

  it('rejects non-uuid academicYearId on patch', async () => {
    const classes = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        classA.id,
        { academicYearId: 'bad' },
        undefined,
        'c',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(classes.updateForTenant).not.toHaveBeenCalled();
  });
});

describe('ClassesService.deleteForTenant', () => {
  it('deletes when empty and audits', async () => {
    const classes = { isAvailable: () => true, deleteForTenant: vi.fn().mockResolvedValue(true) };
    const audit = new InMemoryAuditPublisher();
    const service = new ClassesService(classes as never, null, audit);
    await expect(
      service.deleteForTenant(actorId, tenantId, classA.id, 'c'),
    ).resolves.toBeUndefined();
    expect(classes.deleteForTenant).toHaveBeenCalledWith(actorId, tenantId, classA.id);
    expect(audit.events[0]).toMatchObject({ action: 'class.delete', outcome: 'success' });
  });

  it('maps missing to 404', async () => {
    const classes = { isAvailable: () => true, deleteForTenant: vi.fn().mockResolvedValue(false) };
    const service = new ClassesService(classes as never);
    await expect(service.deleteForTenant(actorId, tenantId, classA.id, 'c')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('maps has-dependents error to CONFLICT', async () => {
    const classes = {
      isAvailable: () => true,
      deleteForTenant: vi.fn().mockRejectedValue({ code: 'P0001', message: 'has dependents' }),
    };
    const service = new ClassesService(classes as never);
    await expect(service.deleteForTenant(actorId, tenantId, classA.id, 'c')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('maps invalid id to 404 without repo call', async () => {
    const classes = { isAvailable: () => true, deleteForTenant: vi.fn() };
    const service = new ClassesService(classes as never);
    await expect(
      service.deleteForTenant(actorId, tenantId, 'not-a-uuid', 'c'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(classes.deleteForTenant).not.toHaveBeenCalled();
  });
});
