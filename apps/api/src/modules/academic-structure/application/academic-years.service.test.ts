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

describe('AcademicYearsService.patchForTenant', () => {
  const corr = 'corr-year-patch';

  it('patches status and audits fields', async () => {
    const updated = { ...yearA, status: 'closed' };
    const academicYears = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new AcademicYearsService(academicYears as never, null, audit);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, { status: 'closed' }, undefined, corr),
    ).resolves.toEqual({ data: updated });
    expect(academicYears.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      yearA.id,
      expect.objectContaining({
        setStatus: true,
        status: 'closed',
        setName: false,
        setCode: false,
        setStartsOn: false,
        setEndsOn: false,
      }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'academic_year.patch',
      metadata: { fields: ['status'] },
    });
  });

  it('maps missing year to 404', async () => {
    const academicYears = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, { status: 'closed' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects empty body', async () => {
    const academicYears = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, {}, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(academicYears.updateForTenant).not.toHaveBeenCalled();
  });

  it('rejects unknown field', async () => {
    const academicYears = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, { tenantId: 'x' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(academicYears.updateForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid id without repo call', async () => {
    const academicYears = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
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
    expect(academicYears.updateForTenant).not.toHaveBeenCalled();
  });

  it('maps unique violation to CONFLICT', async () => {
    const academicYears = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockRejectedValue({ code: '23505', message: 'dup' }),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, { code: 'DUP' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('clears code when set to null', async () => {
    const updated = { ...yearA, code: null };
    const academicYears = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.patchForTenant(actorId, tenantId, yearA.id, { code: null }, undefined, corr),
    ).resolves.toEqual({ data: updated });
    expect(academicYears.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      yearA.id,
      expect.objectContaining({ setCode: true, code: null }),
    );
  });
});

describe('AcademicYearsService.deleteForTenant', () => {
  const corr = 'corr-year-delete';

  it('deletes when empty and audits', async () => {
    const academicYears = {
      isAvailable: () => true,
      deleteForTenant: vi.fn().mockResolvedValue(true),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new AcademicYearsService(academicYears as never, null, audit);
    await expect(
      service.deleteForTenant(actorId, tenantId, yearA.id, corr),
    ).resolves.toBeUndefined();
    expect(academicYears.deleteForTenant).toHaveBeenCalledWith(actorId, tenantId, yearA.id);
    expect(audit.events[0]).toMatchObject({ action: 'academic_year.delete', outcome: 'success' });
  });

  it('maps missing to 404', async () => {
    const academicYears = {
      isAvailable: () => true,
      deleteForTenant: vi.fn().mockResolvedValue(false),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.deleteForTenant(actorId, tenantId, yearA.id, corr)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('maps invalid id to 404 without repo call', async () => {
    const academicYears = { isAvailable: () => true, deleteForTenant: vi.fn() };
    const service = new AcademicYearsService(academicYears as never);
    await expect(
      service.deleteForTenant(actorId, tenantId, 'not-a-uuid', corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(academicYears.deleteForTenant).not.toHaveBeenCalled();
  });

  it('maps has-dependents error to CONFLICT', async () => {
    const academicYears = {
      isAvailable: () => true,
      deleteForTenant: vi.fn().mockRejectedValue({ code: 'P0001', message: 'has dependents' }),
    };
    const service = new AcademicYearsService(academicYears as never);
    await expect(service.deleteForTenant(actorId, tenantId, yearA.id, corr)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});
