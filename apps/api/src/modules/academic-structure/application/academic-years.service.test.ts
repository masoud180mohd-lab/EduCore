import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

describe('AcademicYearsService.getForTenant', () => {
  it('returns envelope when found', async () => {
    const academicYears = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(yearA),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.getForTenant(actorId, tenantId, yearA.id)).resolves.toEqual({
      data: yearA,
    });
  });

  it('maps missing to 404', async () => {
    const academicYears = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.getForTenant(actorId, tenantId, yearA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('maps invalid uuid to 404 without repo call', async () => {
    const academicYears = { isAvailable: () => true, getByIdForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.getForTenant(actorId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(academicYears.getByIdForTenant).not.toHaveBeenCalled();
  });
});

describe('AcademicYearsService.createForTenant', () => {
  it('creates with idempotency and audit', async () => {
    const academicYears = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(yearA),
    };
    const idempotency = new InMemoryIdempotencyStore();
    const audit = new InMemoryAuditPublisher();
    const service = new AcademicYearsService(academicYears as never, idempotency, audit);
    const key = 'idem-key-academic-year-create01';
    const body = { name: '2026/2027', status: 'active', code: '2026-27' };
    const first = await service.createForTenant(actorId, tenantId, body, key, 'corr-1');
    expect(first.data).toEqual(yearA);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({ action: 'academic_year.create', outcome: 'success' });

    academicYears.createForTenant.mockClear();
    const second = await service.createForTenant(actorId, tenantId, body, key, 'corr-1');
    expect(second).toEqual(first);
    expect(academicYears.createForTenant).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key', async () => {
    const academicYears = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.createForTenant(actorId, tenantId, { name: 'Y' }, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects unknown body fields', async () => {
    const academicYears = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { name: 'Y', tenantId },
        'idem-key-academic-year-create02',
        'c',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
