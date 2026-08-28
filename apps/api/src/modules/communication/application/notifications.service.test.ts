import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { createNotificationsServiceForTest } from './notifications.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const guardianId = '01900000-0000-7000-8000-0000000000b1';
const idempotencyKey = '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d';

describe('NotificationsService.createRequestForTenant', () => {
  it('rejects without idempotency key', async () => {
    const service = createNotificationsServiceForTest({
      isAvailable: () => true,
    } as never);
    await expect(
      service.createRequestForTenant(
        actorUserId,
        tenantId,
        {
          templateCode: 'comms_test_sms',
          recipientId: guardianId,
          payload: { school_name: 'Test' },
        },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects unknown payload keys', async () => {
    const service = createNotificationsServiceForTest({
      isAvailable: () => true,
    } as never);
    await expect(
      service.createRequestForTenant(
        actorUserId,
        tenantId,
        {
          templateCode: 'comms_test_sms',
          recipientId: guardianId,
          payload: { school_name: 'Test', hack: 'x' },
        },
        idempotencyKey,
        'corr',
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('returns the queued request without sending (async outbox contract)', async () => {
    const createRequest = vi.fn().mockResolvedValue({
      id: '01900000-0000-7000-8000-0000000000r1',
      tenantId,
      templateCode: 'comms_test_sms',
      templateVersion: 1,
      locale: 'sw',
      channel: 'sms',
      recipientType: 'guardian',
      recipientId: guardianId,
      payload: { school_name: 'Shule' },
      status: 'queued',
      skipReason: null,
      destE164: '0712345678',
      phoneLast4: '5678',
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });
    const completeSend = vi.fn();
    const service = createNotificationsServiceForTest({
      isAvailable: () => true,
      createRequest,
      completeSend,
    } as never);

    const result = await service.createRequestForTenant(
      actorUserId,
      tenantId,
      {
        templateCode: 'comms_test_sms',
        recipientId: guardianId,
        payload: { school_name: 'Shule' },
      },
      idempotencyKey,
      'corr',
    );

    // COMMS-006: sending happens in the outbox worker, never in the request path.
    expect(result.data.status).toBe('queued');
    expect(result.data).not.toHaveProperty('destE164');
    expect(result.data).not.toHaveProperty('phoneLast4');
    expect(completeSend).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.handleBeemWebhook', () => {
  it('returns 501 when webhook secret unset', async () => {
    const prev = process.env['BEEM_WEBHOOK_SECRET'];
    delete process.env['BEEM_WEBHOOK_SECRET'];
    try {
      const service = createNotificationsServiceForTest({
        isAvailable: () => true,
      } as never);
      await expect(
        service.handleBeemWebhook({ request_id: '67', status: 'DELIVERED' }, 'x'),
      ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    } finally {
      if (prev === undefined) delete process.env['BEEM_WEBHOOK_SECRET'];
      else process.env['BEEM_WEBHOOK_SECRET'] = prev;
    }
  });

  it('rejects bad secret', async () => {
    const prev = process.env['BEEM_WEBHOOK_SECRET'];
    process.env['BEEM_WEBHOOK_SECRET'] = 'expected-secret';
    try {
      const service = createNotificationsServiceForTest({
        isAvailable: () => true,
      } as never);
      await expect(
        service.handleBeemWebhook({ request_id: '67', status: 'DELIVERED' }, 'wrong'),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    } finally {
      if (prev === undefined) delete process.env['BEEM_WEBHOOK_SECRET'];
      else process.env['BEEM_WEBHOOK_SECRET'] = prev;
    }
  });

  it('applies delivery report when secret matches', async () => {
    const prev = process.env['BEEM_WEBHOOK_SECRET'];
    process.env['BEEM_WEBHOOK_SECRET'] = 'expected-secret';
    try {
      const applyBeemDeliveryReport = vi.fn().mockResolvedValue({
        deliveryId: 'd1',
        tenantId,
        requestId: 'r1',
        updated: true,
        detail: 'updated',
      });
      const service = createNotificationsServiceForTest({
        isAvailable: () => true,
        applyBeemDeliveryReport,
      } as never);
      const result = await service.handleBeemWebhook(
        { request_id: 67, status: 'DELIVERED' },
        'expected-secret',
      );
      expect(result.data).toEqual({
        accepted: true,
        updated: true,
        detail: 'updated',
        deliveryId: 'd1',
      });
      expect(applyBeemDeliveryReport).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: '67',
          deliveryStatus: 'DELIVERED',
        }),
      );
    } finally {
      if (prev === undefined) delete process.env['BEEM_WEBHOOK_SECRET'];
      else process.env['BEEM_WEBHOOK_SECRET'] = prev;
    }
  });
});

describe('NotificationsService.listDeliveriesForTenant / usage', () => {
  it('returns paginated deliveries with filters', async () => {
    const listDeliveries = vi.fn().mockResolvedValue({
      rows: [
        {
          id: '01900000-0000-7000-8000-0000000000d1',
          tenantId,
          requestId: guardianId,
          providerCode: 'fake',
          providerMessageId: 'm1',
          phoneLast4: '5678',
          status: 'sent',
          segmentCount: 1,
          errorCode: null,
          createdAt: '2026-08-03T00:00:00.000Z',
          updatedAt: '2026-08-03T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    const service = createNotificationsServiceForTest({
      isAvailable: () => true,
      listDeliveries,
    } as never);

    const result = await service.listDeliveriesForTenant(actorUserId, tenantId, {
      limit: '10',
      status: 'sent',
      requestId: guardianId,
    });

    expect(result.page).toEqual({ nextCursor: null, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(listDeliveries).toHaveBeenCalledWith(
      actorUserId,
      tenantId,
      expect.objectContaining({
        limit: 10,
        status: 'sent',
        requestId: guardianId,
      }),
    );
  });

  it('rejects invalid delivery status filter', async () => {
    const service = createNotificationsServiceForTest({
      isAvailable: () => true,
      listDeliveries: vi.fn(),
    } as never);
    await expect(
      service.listDeliveriesForTenant(actorUserId, tenantId, { status: 'bogus' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns usage meter with dailyCap', async () => {
    const prevCap = process.env['SMS_DAILY_CAP_PER_TENANT'];
    const prevBypass = process.env['SMS_BYPASS_DAILY_CAP'];
    process.env['SMS_DAILY_CAP_PER_TENANT'] = '42';
    delete process.env['SMS_BYPASS_DAILY_CAP'];
    try {
      const getUsageDaily = vi.fn().mockResolvedValue({
        usageDate: '2026-08-03',
        channel: 'sms',
        sentCount: 3,
        segmentCount: 4,
      });
      const service = createNotificationsServiceForTest({
        isAvailable: () => true,
        getUsageDaily,
      } as never);
      const result = await service.getUsageForTenant(actorUserId, tenantId, '2026-08-03');
      expect(result.data).toEqual({
        usageDate: '2026-08-03',
        channel: 'sms',
        sentCount: 3,
        segmentCount: 4,
        dailyCap: 42,
        bypassDailyCap: false,
      });
    } finally {
      if (prevCap === undefined) delete process.env['SMS_DAILY_CAP_PER_TENANT'];
      else process.env['SMS_DAILY_CAP_PER_TENANT'] = prevCap;
      if (prevBypass === undefined) delete process.env['SMS_BYPASS_DAILY_CAP'];
      else process.env['SMS_BYPASS_DAILY_CAP'] = prevBypass;
    }
  });

  it('reports bypassDailyCap when SMS_BYPASS_DAILY_CAP=true', async () => {
    const prev = process.env['SMS_BYPASS_DAILY_CAP'];
    process.env['SMS_BYPASS_DAILY_CAP'] = 'true';
    try {
      const service = createNotificationsServiceForTest({
        isAvailable: () => true,
        getUsageDaily: vi.fn().mockResolvedValue({
          usageDate: '2026-08-03',
          channel: 'sms',
          sentCount: 0,
          segmentCount: 0,
        }),
      } as never);
      const result = await service.getUsageForTenant(actorUserId, tenantId, '2026-08-03');
      expect(result.data.bypassDailyCap).toBe(true);
      expect(result.data.dailyCap).toBeNull();
    } finally {
      if (prev === undefined) delete process.env['SMS_BYPASS_DAILY_CAP'];
      else process.env['SMS_BYPASS_DAILY_CAP'] = prev;
    }
  });
});
