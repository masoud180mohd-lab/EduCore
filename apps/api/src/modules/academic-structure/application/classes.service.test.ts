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
