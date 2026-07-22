import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { InvoicesService } from './invoices.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const invoiceId = '01900000-0000-7000-8000-0000000000f1';
const studentId = '01900000-0000-7000-8000-0000000000b1';
const academicYearId = '01900000-0000-7000-8000-0000000000a2';
const idempotencyKey = '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d';

function makeService(repo: Record<string, unknown>): InvoicesService {
  return new InvoicesService(repo as never, null, null);
}

describe('InvoicesService', () => {
  it('returns empty page when store unavailable', async () => {
    const service = makeService({ isAvailable: () => false });
    const result = await service.listForTenant(actorUserId, tenantId, {});
    expect(result.data).toEqual([]);
    expect(result.page.limit).toBe(25);
  });

  it('returns 404 for unknown invoice', async () => {
    const service = makeService({
      isAvailable: () => true,
      getInvoiceWithLines: vi.fn().mockResolvedValue(null),
    });
    await expect(service.getForTenant(actorUserId, tenantId, invoiceId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns detail with lines on success', async () => {
    const invoice = {
      id: invoiceId,
      tenantId,
      studentId,
      academicYearId,
      feeStructureId: null,
      status: 'draft',
      currency: 'TZS',
      totalMinor: 1000,
      balanceMinor: 1000,
      issuedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const lines = [
      {
        id: 'line-1',
        invoiceId,
        description: 'Tuition',
        amountMinor: 1000,
        feeStructureItemId: null,
      },
    ];
    const service = makeService({
      isAvailable: () => true,
      getInvoiceWithLines: vi.fn().mockResolvedValue({ invoice, lines }),
    });
    const result = await service.getForTenant(actorUserId, tenantId, invoiceId);
    expect(result.data).toMatchObject({ id: invoiceId, balanceMinor: 1000, lines });
  });

  it('rejects create without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        {
          studentId,
          academicYearId,
          lines: [{ description: 'Tuition', amountMinor: 1000 }],
        },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects float amountMinor on lines', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        {
          studentId,
          academicYearId,
          lines: [{ description: 'Tuition', amountMinor: 10.5 }],
        },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects issue without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.issueForTenant(actorUserId, tenantId, invoiceId, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('returns 404 when issuing an unknown invoice', async () => {
    const service = makeService({
      isAvailable: () => true,
      issueInvoice: vi.fn().mockRejectedValue({ code: 'P0002' }),
    });
    await expect(
      service.issueForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps issuing a non-draft invoice to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      issueInvoice: vi.fn().mockRejectedValue({ code: '55000' }),
    });
    await expect(
      service.issueForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps student not found to validation on create', async () => {
    const service = makeService({
      isAvailable: () => true,
      createInvoiceDraft: vi
        .fn()
        .mockRejectedValue({ code: '22023', message: 'student not found' }),
    });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        {
          studentId,
          academicYearId,
          lines: [{ description: 'Tuition', amountMinor: 1000 }],
        },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('calls issueInvoice on issue', async () => {
    const issueInvoice = vi.fn().mockResolvedValue({
      id: invoiceId,
      tenantId,
      studentId,
      academicYearId,
      feeStructureId: null,
      status: 'issued',
      currency: 'TZS',
      totalMinor: 1000,
      balanceMinor: 1000,
      issuedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const service = makeService({ isAvailable: () => true, issueInvoice });
    const result = await service.issueForTenant(
      actorUserId,
      tenantId,
      invoiceId,
      idempotencyKey,
      'corr',
    );
    expect(issueInvoice).toHaveBeenCalledWith(actorUserId, tenantId, invoiceId);
    expect(result.data.status).toBe('issued');
  });

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toBeInstanceOf(AppError);
  });

  it('rejects void without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.voidForTenant(actorUserId, tenantId, invoiceId, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('returns 404 when voiding an unknown invoice', async () => {
    const service = makeService({
      isAvailable: () => true,
      voidInvoice: vi.fn().mockRejectedValue({ code: 'P0002' }),
    });
    await expect(
      service.voidForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps voiding a non-issued invoice to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      voidInvoice: vi.fn().mockRejectedValue({ code: '55000', message: 'invoice not voidable' }),
    });
    await expect(
      service.voidForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'Invoice is not in issued status.' });
  });

  it('maps voiding an invoice with active payments to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      voidInvoice: vi
        .fn()
        .mockRejectedValue({ code: '55000', message: 'invoice has active payments' }),
    });
    await expect(
      service.voidForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Invoice has active payments and cannot be voided.',
    });
  });

  it('maps a missing membership on void to forbidden', async () => {
    const service = makeService({
      isAvailable: () => true,
      voidInvoice: vi.fn().mockRejectedValue({ code: '42501' }),
    });
    await expect(
      service.voidForTenant(actorUserId, tenantId, invoiceId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('calls voidInvoice on void success', async () => {
    const voidInvoice = vi.fn().mockResolvedValue({
      id: invoiceId,
      tenantId,
      studentId,
      academicYearId,
      feeStructureId: null,
      status: 'void',
      currency: 'TZS',
      totalMinor: 1000,
      balanceMinor: 0,
      issuedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const service = makeService({ isAvailable: () => true, voidInvoice });
    const result = await service.voidForTenant(
      actorUserId,
      tenantId,
      invoiceId,
      idempotencyKey,
      'corr',
    );
    expect(voidInvoice).toHaveBeenCalledWith(actorUserId, tenantId, invoiceId);
    expect(result.data.status).toBe('void');
    expect(result.data.balanceMinor).toBe(0);
  });

  it('replays idempotent void with matching body', async () => {
    const voidInvoice = vi.fn().mockResolvedValue({
      id: invoiceId,
      tenantId,
      studentId,
      academicYearId,
      feeStructureId: null,
      status: 'void',
      currency: 'TZS',
      totalMinor: 1000,
      balanceMinor: 0,
      issuedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
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
    const service = new InvoicesService(
      { isAvailable: () => true, voidInvoice } as never,
      idempotency,
      null,
    );
    const first = await service.voidForTenant(
      actorUserId,
      tenantId,
      invoiceId,
      idempotencyKey,
      'corr',
    );
    const second = await service.voidForTenant(
      actorUserId,
      tenantId,
      invoiceId,
      idempotencyKey,
      'corr',
    );
    expect(voidInvoice).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
