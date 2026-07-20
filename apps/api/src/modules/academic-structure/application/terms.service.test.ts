import { describe, expect, it, vi } from 'vitest';

import { TermsService } from './terms.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';
const termA = {
  id: '01900000-0000-7000-8000-0000000000d1',
  tenantId,
  academicYearId: yearId,
  name: 'Term 1',
  code: 'T1',
  startsOn: '2026-01-15',
  endsOn: '2026-04-15',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('TermsService.listForTenant', () => {
  it('returns paginated terms from repository', async () => {
    const terms = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [termA], nextCursor: null }),
    };
    const service = new TermsService(terms as never);
    const result = await service.listForTenant(actorId, tenantId, {});
    expect(result).toEqual({
      data: [termA],
      page: { nextCursor: null, limit: 25 },
    });
    expect(terms.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      academicYearId: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('returns empty page when pool unavailable', async () => {
    const terms = { isAvailable: () => false, listForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(terms.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects invalid status', async () => {
    const terms = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.listForTenant(actorId, tenantId, { status: 'open' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects non-uuid academicYearId with VALIDATION_ERROR', async () => {
    const terms = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.listForTenant(actorId, tenantId, { academicYearId: 'not-a-uuid' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(terms.listForTenant).not.toHaveBeenCalled();
  });

  it('passes academicYearId filter and does not invent 403 for missing year', async () => {
    const terms = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new TermsService(terms as never);
    const foreignYear = '01900000-0000-7000-8000-0000000000ff';
    await expect(
      service.listForTenant(actorId, tenantId, { academicYearId: foreignYear }),
    ).resolves.toEqual({
      data: [],
      page: { nextCursor: null, limit: 25 },
    });
    expect(terms.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 25,
      cursor: undefined,
      academicYearId: foreignYear,
      status: undefined,
      search: undefined,
    });
  });

  it('passes pagination, status, and escaped search', async () => {
    const terms = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }),
    };
    const service = new TermsService(terms as never);
    await service.listForTenant(actorId, tenantId, {
      limit: '10',
      cursor: termA.id,
      academicYearId: yearId,
      status: 'active',
      search: 'a%b_c',
    });
    expect(terms.listForTenant).toHaveBeenCalledWith(actorId, tenantId, {
      limit: 10,
      cursor: termA.id,
      academicYearId: yearId,
      status: 'active',
      search: 'a\\%b\\_c',
    });
  });

  it('rejects non-uuid actor', async () => {
    const terms = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('TermsService.getForTenant', () => {
  it('returns envelope when found', async () => {
    const terms = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(termA),
    };
    const service = new TermsService(terms as never);
    await expect(service.getForTenant(actorId, tenantId, termA.id)).resolves.toEqual({
      data: termA,
    });
  });

  it('maps missing to 404 with generic message', async () => {
    const terms = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new TermsService(terms as never);
    await expect(service.getForTenant(actorId, tenantId, termA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Term not found.',
    });
  });

  it('maps invalid uuid to 404 without repo call', async () => {
    const terms = { isAvailable: () => true, getByIdForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(service.getForTenant(actorId, tenantId, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Term not found.',
    });
    expect(terms.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('maps no pool to 404 without repo call', async () => {
    const terms = { isAvailable: () => false, getByIdForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(service.getForTenant(actorId, tenantId, termA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(terms.getByIdForTenant).not.toHaveBeenCalled();
  });
});
