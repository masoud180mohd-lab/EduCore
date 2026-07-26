import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { FeeStructuresService } from './fee-structures.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const feeStructureId = '01900000-0000-7000-8000-0000000000f1';
const academicYearId = '01900000-0000-7000-8000-0000000000a2';
const idempotencyKey = '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d';

function makeService(repo: Record<string, unknown>): FeeStructuresService {
  return new FeeStructuresService(repo as never, null, null);
}

describe('FeeStructuresService', () => {
  it('returns empty page when store unavailable', async () => {
    const service = makeService({ isAvailable: () => false });
    const result = await service.listForTenant(actorUserId, tenantId, {});
    expect(result.data).toEqual([]);
    expect(result.page.limit).toBe(25);
  });

  it('returns 404 for unknown fee structure', async () => {
    const service = makeService({
      isAvailable: () => true,
      getFeeStructure: vi.fn().mockResolvedValue(null),
    });
    await expect(service.getForTenant(actorUserId, tenantId, feeStructureId)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('returns detail with items on success', async () => {
    const structure = {
      id: feeStructureId,
      tenantId,
      academicYearId,
      name: 'Term 1 Fees',
      status: 'draft',
      currency: 'TZS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const items = [
      { id: 'item-1', feeStructureId, name: 'Tuition', amountMinor: 1000, sortOrder: 0 },
    ];
    const service = makeService({
      isAvailable: () => true,
      getFeeStructure: vi.fn().mockResolvedValue(structure),
      listFeeStructureItems: vi.fn().mockResolvedValue(items),
    });
    const result = await service.getForTenant(actorUserId, tenantId, feeStructureId);
    expect(result.data).toMatchObject({ id: feeStructureId, items });
  });

  it('rejects create without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [{ name: 'Tuition', amountMinor: 1000 }] },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects float amountMinor on items', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [{ name: 'Tuition', amountMinor: 10.5 }] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects zero or negative amountMinor on items', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [{ name: 'Tuition', amountMinor: 0 }] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects empty items array', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects unknown fields', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        {
          academicYearId,
          name: 'Term 1',
          items: [{ name: 'Tuition', amountMinor: 1000 }],
          extra: true,
        },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps duplicate fee structure to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      createFeeStructure: vi.fn().mockRejectedValue({ code: '23505' }),
    });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [{ name: 'Tuition', amountMinor: 1000 }] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps academic year not found to validation', async () => {
    const service = makeService({
      isAvailable: () => true,
      createFeeStructure: vi
        .fn()
        .mockRejectedValue({ code: '22023', message: 'academic year not found' }),
    });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { academicYearId, name: 'Term 1', items: [{ name: 'Tuition', amountMinor: 1000 }] },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('replays idempotent create with matching body', async () => {
    const createFeeStructure = vi.fn().mockResolvedValue({
      id: feeStructureId,
      tenantId,
      academicYearId,
      name: 'Term 1',
      status: 'draft',
      currency: 'TZS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const records = new Map<
      string,
      { bodyHash: string; statusCode: number; responseBody: string; createdAt: string }
    >();
    const idempotency = {
      get: vi.fn((key: string) => Promise.resolve(records.get(key) ?? null)),
      put: vi.fn(
        (
          key: string,
          record: { bodyHash: string; statusCode: number; responseBody: string; createdAt: string },
        ) => {
          records.set(key, record);
          return Promise.resolve();
        },
      ),
    };
    const service = new FeeStructuresService(
      { isAvailable: () => true, createFeeStructure } as never,
      idempotency,
      null,
    );
    const body = {
      academicYearId,
      name: 'Term 1',
      items: [{ name: 'Tuition', amountMinor: 1000 }],
    };
    const first = await service.createForTenant(
      actorUserId,
      tenantId,
      body,
      idempotencyKey,
      'corr',
    );
    const second = await service.createForTenant(
      actorUserId,
      tenantId,
      body,
      idempotencyKey,
      'corr',
    );
    expect(createFeeStructure).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it.each([
    [{}, 'at least one field'],
    [{ extra: true }, 'unknown field'],
    [{ name: '   ' }, 'empty name'],
    [{ status: 'deleted' }, 'invalid status'],
    [{ items: [] }, 'empty items'],
    [{ items: [{ name: 'Tuition', amountMinor: 10.5, sortOrder: 0 }] }, 'float amount'],
  ])('rejects invalid patch body: %s (%s)', async (body: unknown, _description: string) => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.patchForTenant(actorUserId, tenantId, feeStructureId, body, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects an invalid patch fee structure id as validation', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.patchForTenant(actorUserId, tenantId, 'bad', { name: 'Term 2' }, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('patches fields, replaces item ids, and returns detail with items', async () => {
    const updateFeeStructure = vi.fn().mockResolvedValue({
      id: feeStructureId,
      tenantId,
      academicYearId,
      name: 'Term 2 Fees',
      status: 'active',
      currency: 'TZS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const items = [
      {
        id: '01900000-0000-7000-8000-0000000000b1',
        feeStructureId,
        name: 'Tuition',
        amountMinor: 2500,
        sortOrder: 1,
      },
    ];
    const listFeeStructureItems = vi.fn().mockResolvedValue(items);
    const service = makeService({
      isAvailable: () => true,
      updateFeeStructure,
      listFeeStructureItems,
    });

    const result = await service.patchForTenant(
      actorUserId,
      tenantId,
      feeStructureId,
      {
        name: ' Term 2 Fees ',
        status: 'active',
        items: [{ name: ' Tuition ', amountMinor: 2500, sortOrder: 1 }],
      },
      undefined,
      'corr',
    );

    expect(result.data).toMatchObject({ id: feeStructureId, name: 'Term 2 Fees', items });
    expect(updateFeeStructure).toHaveBeenCalledWith(
      actorUserId,
      tenantId,
      feeStructureId,
      expect.objectContaining({
        setName: true,
        name: 'Term 2 Fees',
        setStatus: true,
        status: 'active',
        setItems: true,
        items: [
          expect.objectContaining({
            // Vitest asymmetric matchers are typed as any.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            name: 'Tuition',
            amountMinor: 2500,
            sortOrder: 1,
          }),
        ],
      }),
    );
    expect(listFeeStructureItems).toHaveBeenCalledWith(actorUserId, tenantId, feeStructureId);
  });

  it('returns 404 when patch target does not exist', async () => {
    const service = makeService({
      isAvailable: () => true,
      updateFeeStructure: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.patchForTenant(
        actorUserId,
        tenantId,
        feeStructureId,
        { status: 'archived' },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('replays an idempotent patch with the same detail response', async () => {
    const row = {
      id: feeStructureId,
      tenantId,
      academicYearId,
      name: 'Term 2',
      status: 'draft',
      currency: 'TZS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const updateFeeStructure = vi.fn().mockResolvedValue(row);
    const listFeeStructureItems = vi.fn().mockResolvedValue([]);
    const records = new Map<
      string,
      { bodyHash: string; statusCode: number; responseBody: string; createdAt: string }
    >();
    const idempotency = {
      get: vi.fn((key: string) => Promise.resolve(records.get(key) ?? null)),
      put: vi.fn(
        (
          key: string,
          record: { bodyHash: string; statusCode: number; responseBody: string; createdAt: string },
        ) => {
          records.set(key, record);
          return Promise.resolve();
        },
      ),
    };
    const service = new FeeStructuresService(
      { isAvailable: () => true, updateFeeStructure, listFeeStructureItems } as never,
      idempotency,
      null,
    );

    const first = await service.patchForTenant(
      actorUserId,
      tenantId,
      feeStructureId,
      { name: 'Term 2' },
      idempotencyKey,
      'corr',
    );
    const second = await service.patchForTenant(
      actorUserId,
      tenantId,
      feeStructureId,
      { name: 'Term 2' },
      idempotencyKey,
      'corr',
    );

    expect(second).toEqual(first);
    expect(updateFeeStructure).toHaveBeenCalledTimes(1);
    expect(listFeeStructureItems).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ code: '23503' }, 'foreign key'],
    [{ code: 'P0001', message: 'fee structure items are in use by invoices' }, 'helper guard'],
  ])(
    'maps item replacement %s conflict (%s)',
    async (databaseError: unknown, _description: string) => {
      const service = makeService({
        isAvailable: () => true,
        updateFeeStructure: vi.fn().mockRejectedValue(databaseError),
      });
      await expect(
        service.patchForTenant(
          actorUserId,
          tenantId,
          feeStructureId,
          { items: [{ name: 'Tuition', amountMinor: 1000, sortOrder: 0 }] },
          undefined,
          'corr',
        ),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Fee structure items are in use by invoices.',
      });
    },
  );

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toBeInstanceOf(AppError);
  });
});
