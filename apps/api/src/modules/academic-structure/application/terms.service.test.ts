import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

describe('TermsService.createForTenant', () => {
  it('creates with idempotency and audit', async () => {
    const terms = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(termA),
    };
    const idempotency = new InMemoryIdempotencyStore();
    const audit = new InMemoryAuditPublisher();
    const service = new TermsService(terms as never, idempotency, audit);
    const key = 'idem-key-term-create01';
    const body = {
      academicYearId: yearId,
      name: 'Term 1',
      status: 'active',
      code: 'T1',
    };
    const first = await service.createForTenant(actorId, tenantId, body, key, 'corr-1');
    expect(first.data).toEqual(termA);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({ action: 'term.create', outcome: 'success' });

    terms.createForTenant.mockClear();
    const second = await service.createForTenant(actorId, tenantId, body, key, 'corr-1');
    expect(second).toEqual(first);
    expect(terms.createForTenant).not.toHaveBeenCalled();
  });

  it('requires Idempotency-Key', async () => {
    const terms = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'T' },
        undefined,
        'c',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects unknown body fields including tenantId', async () => {
    const terms = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'T', tenantId },
        'idem-key-term-create02',
        'c',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires academicYearId UUID', async () => {
    const terms = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.createForTenant(actorId, tenantId, { name: 'Term 1' }, 'idem-key-term-create03', 'c'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps parent year not found to VALIDATION_ERROR', async () => {
    const terms = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue({
        code: '22023',
        message: 'parent academic year not found',
      }),
    };
    const service = new TermsService(terms as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'Term 1' },
        'idem-key-term-create04',
        'c',
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'academicYearId not found in this tenant.',
    });
  });

  it('maps unique violation to CONFLICT', async () => {
    const terms = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate' }),
    };
    const service = new TermsService(terms as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { academicYearId: yearId, name: 'Term 1', code: 'T1' },
        'idem-key-term-create05',
        'c',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('defaults status to draft', async () => {
    const terms = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue({ ...termA, status: 'draft' }),
    };
    const service = new TermsService(terms as never);
    await service.createForTenant(
      actorId,
      tenantId,
      { academicYearId: yearId, name: 'Term 1' },
      'idem-key-term-create06',
      'c',
    );
    expect(terms.createForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      expect.objectContaining({
        academicYearId: yearId,
        name: 'Term 1',
        status: 'draft',
      }),
    );
  });
});

describe('TermsService.patchForTenant', () => {
  const corr = 'corr-term-patch';

  it('patches name and audits fields', async () => {
    const updated = { ...termA, name: 'Term One' };
    const terms = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new TermsService(terms as never, null, audit);
    await expect(
      service.patchForTenant(actorId, tenantId, termA.id, { name: 'Term One' }, undefined, corr),
    ).resolves.toEqual({ data: updated });
    expect(terms.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      termA.id,
      expect.objectContaining({ setName: true, name: 'Term One' }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'term.patch',
      metadata: { fields: ['name'] },
    });
  });

  it('rejects empty body', async () => {
    const terms = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new TermsService(terms as never);
    await expect(
      service.patchForTenant(actorId, tenantId, termA.id, {}, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(terms.updateForTenant).not.toHaveBeenCalled();
  });

  it('maps missing term to 404', async () => {
    const terms = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new TermsService(terms as never);
    await expect(
      service.patchForTenant(actorId, tenantId, termA.id, { status: 'closed' }, undefined, corr),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
