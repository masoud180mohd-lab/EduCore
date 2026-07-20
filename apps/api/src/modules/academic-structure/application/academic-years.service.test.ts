import { describe, expect, it, vi } from 'vitest';

import { AcademicYearsService } from './academic-years.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearA = {
  id: '01900000-0000-7000-8000-0000000000c1',
  tenantId,
  name: '2026/2027',
  code: '2026-27',
  startsOn: '2026-01-15',
  endsOn: '2026-12-15',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AcademicYearsService.listForTenant', () => {
  it('returns paginated academic years from repository', async () => {
    const academicYears = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [yearA], nextCursor: null }),
    };
    const service = new AcademicYearsService(academicYears as never);
    const result = await service.listForTenant(actorId, tenantId, {});
    expect(result).toEqual({
      data: [yearA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(academicYears.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const academicYears = { isAvailable: () => false, listForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(academicYears.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid status', async () => {
    const academicYears = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.listForTenant(actorId, tenantId, { status: 'open' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('passes pagination, status, and escaped search', async () => {
    const academicYears = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new AcademicYearsService(academicYears as never);
    await service.listForTenant(actorId, tenantId, {
      limit: '10',
      cursor: yearA.id,
      status: 'active',
      search: 'a%b_c',
    });
    expect(academicYears.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 10,
      cursor: yearA.id,
      status: 'active',
      search: 'a\\%b\\_c',
    });
  });

  it('rejects non-uuid actor', async () => {
    const academicYears = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
