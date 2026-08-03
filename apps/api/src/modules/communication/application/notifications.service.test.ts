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

  it('sends via Fake when request is queued', async () => {
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
    const completeSend = vi.fn().mockResolvedValue({
      deliveryId: 'd1',
      requestStatus: 'succeeded',
      deliveryStatus: 'sent',
    });
    const getRequest = vi.fn().mockResolvedValue({
      id: '01900000-0000-7000-8000-0000000000r1',
      tenantId,
      templateCode: 'comms_test_sms',
      templateVersion: 1,
      locale: 'sw',
      channel: 'sms',
      recipientType: 'guardian',
      recipientId: guardianId,
      payload: { school_name: 'Shule' },
      status: 'succeeded',
      skipReason: null,
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });
    const getTemplateBody = vi.fn().mockResolvedValue('{{school_name}}: EduCore SMS test.');
    const sms = {
      providerCode: 'fake',
      send: vi.fn().mockResolvedValue({
        providerCode: 'fake',
        providerMessageId: 'fake_msg_1',
        status: 'sent',
      }),
    };
    const service = createNotificationsServiceForTest(
      {
        isAvailable: () => true,
        createRequest,
        completeSend,
        getRequest,
        getTemplateBody,
      } as never,
      sms,
    );

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

    expect(result.data.status).toBe('succeeded');
    expect(sms.send).toHaveBeenCalledOnce();
    expect(completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: 'fake',
        deliveryStatus: 'sent',
        destE164: '255712345678',
      }),
    );
  });
});
