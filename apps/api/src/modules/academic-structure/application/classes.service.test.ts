import { describe, expect, it, vi } from 'vitest';

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
