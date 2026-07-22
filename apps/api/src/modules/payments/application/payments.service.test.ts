import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { PaymentsService } from './payments.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const invoiceId = '01900000-0000-7000-8000-0000000000f1';
const paymentId = '01900000-0000-7000-8000-0000000000d1';
const idempotencyKey = '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d';

function makeService(repo: Record<string, unknown>): PaymentsService {
  return new PaymentsService(repo as never, null, null);
}

function makeReversedPayment(): Record<string, unknown> {
  return {
    id: paymentId,
    tenantId,
    invoiceId,
    method: 'cash',
    amountMinor: 1000,
    currency: 'TZS',
    status: 'reversed',
    receiptId: '01900000-0000-7000-8000-0000000000e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  };
}

describe('PaymentsService.reverseForTenant', () => {
  it('rejects reverse without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.reverseForTenant(actorUserId, tenantId, paymentId, undefined, 'corr'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('returns 404 when reversing an unknown payment', async () => {
    const service = makeService({
      isAvailable: () => true,
      reversePayment: vi.fn().mockRejectedValue({ code: 'P0002' }),
    });
    await expect(
      service.reverseForTenant(actorUserId, tenantId, paymentId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps reversing a non-succeeded payment to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      reversePayment: vi.fn().mockRejectedValue({ code: '55000' }),
    });
    await expect(
      service.reverseForTenant(actorUserId, tenantId, paymentId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Payment is not in succeeded status and cannot be reversed.',
    });
  });

  it('maps a missing membership on reverse to forbidden', async () => {
    const service = makeService({
      isAvailable: () => true,
      reversePayment: vi.fn().mockRejectedValue({ code: '42501' }),
    });
    await expect(
      service.reverseForTenant(actorUserId, tenantId, paymentId, idempotencyKey, 'corr'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('calls reversePayment on reverse success', async () => {
    const reversePayment = vi.fn().mockResolvedValue(makeReversedPayment());
    const service = makeService({ isAvailable: () => true, reversePayment });
    const result = await service.reverseForTenant(
      actorUserId,
      tenantId,
      paymentId,
      idempotencyKey,
      'corr',
    );
    expect(reversePayment).toHaveBeenCalledWith(actorUserId, tenantId, paymentId);
    expect(result.data.status).toBe('reversed');
  });

  it('replays idempotent reverse with matching body', async () => {
    const reversePayment = vi.fn().mockResolvedValue(makeReversedPayment());
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
    const service = new PaymentsService(
      { isAvailable: () => true, reversePayment } as never,
      idempotency,
      null,
    );
    const first = await service.reverseForTenant(
      actorUserId,
      tenantId,
      paymentId,
      idempotencyKey,
      'corr',
    );
    const second = await service.reverseForTenant(
      actorUserId,
      tenantId,
      paymentId,
      idempotencyKey,
      'corr',
    );
    expect(reversePayment).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.reverseForTenant('bad', tenantId, paymentId, idempotencyKey, 'corr'),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('PaymentsService.handleFakeWebhookForTenant', () => {
  it('rejects unknown fields', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.handleFakeWebhookForTenant(
        actorUserId,
        tenantId,
        { eventId: 'evt-1', amountMinor: 1000, outcome: 'succeeded', extra: true },
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects an invalid outcome', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.handleFakeWebhookForTenant(
        actorUserId,
        tenantId,
        { eventId: 'evt-1', amountMinor: 1000, outcome: 'unknown' },
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns duplicate=false for a first-seen event and does not throw', async () => {
    const recordGatewayEvent = vi.fn().mockResolvedValue({
      id: '01900000-0000-7000-8000-0000000000e2',
      inserted: true,
    });
    const service = makeService({ isAvailable: () => true, recordGatewayEvent });
    const result = await service.handleFakeWebhookForTenant(
      actorUserId,
      tenantId,
      { eventId: 'evt-1', amountMinor: 1000, outcome: 'succeeded' },
      'corr',
    );
    expect(result.data).toEqual({ accepted: true, duplicate: false });
    expect(recordGatewayEvent).toHaveBeenCalledTimes(1);
  });

  it('returns duplicate=true when the event id was already recorded and does not throw', async () => {
    const recordGatewayEvent = vi.fn().mockResolvedValue({
      id: '01900000-0000-7000-8000-0000000000e3',
      inserted: false,
    });
    const service = makeService({ isAvailable: () => true, recordGatewayEvent });
    const result = await service.handleFakeWebhookForTenant(
      actorUserId,
      tenantId,
      { eventId: 'evt-1', amountMinor: 1000, outcome: 'succeeded' },
      'corr',
    );
    expect(result.data).toEqual({ accepted: true, duplicate: true });
  });

  it('propagates a duplicate call across two invocations without throwing', async () => {
    const seen = new Set<string>();
    const recordGatewayEvent = vi.fn(
      (_actor: string, _tenant: string, input: { providerEventId: string }) => {
        const inserted = !seen.has(input.providerEventId);
        seen.add(input.providerEventId);
        return Promise.resolve({ id: '01900000-0000-7000-8000-0000000000e4', inserted });
      },
    );
    const service = makeService({ isAvailable: () => true, recordGatewayEvent });
    const body = { eventId: 'evt-dup', amountMinor: 500, outcome: 'succeeded' as const };
    const first = await service.handleFakeWebhookForTenant(actorUserId, tenantId, body, 'corr');
    const second = await service.handleFakeWebhookForTenant(actorUserId, tenantId, body, 'corr');
    expect(first.data.duplicate).toBe(false);
    expect(second.data.duplicate).toBe(true);
  });

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.handleFakeWebhookForTenant(
        'bad',
        tenantId,
        { eventId: 'evt-1', amountMinor: 1000, outcome: 'succeeded' },
        'corr',
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
