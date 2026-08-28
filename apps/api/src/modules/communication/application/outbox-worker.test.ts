import { describe, expect, it, vi } from 'vitest';

import type { NotificationsRepository } from '../repositories/notifications.repository.js';
import type { ClaimedOutboxEvent } from '../repositories/notifications.repository.js';
import type { SmsProviderPort } from '../providers/sms-provider.port.js';
import {
  SmsOutboxWorker,
  backoffSecondsForAttempt,
  loadOutboxWorkerConfig,
  type OutboxWorkerConfig,
} from './outbox-worker.js';

const tenantId = '01900000-0000-7000-8000-0000000000aa';
const createdByUserId = '01900000-0000-7000-8000-000000000001';

const config: OutboxWorkerConfig = {
  enabled: true,
  pollMs: 1_000,
  batchSize: 10,
  claimSeconds: 120,
  maxAttempts: 5,
};

function makeEvent(overrides: Partial<ClaimedOutboxEvent> = {}): ClaimedOutboxEvent {
  return {
    eventId: '01900000-0000-7000-8000-0000000000e1',
    tenantId,
    requestId: '01900000-0000-7000-8000-0000000000r1',
    attempts: 1,
    createdByUserId,
    ...overrides,
  };
}

function makeContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestId: '01900000-0000-7000-8000-0000000000r1',
    tenantId,
    templateCode: 'comms_test_sms',
    templateVersion: 1,
    locale: 'sw',
    payload: { school_name: 'Shule' },
    status: 'queued',
    createdByUserId,
    templateBody: '{{school_name}}: EduCore SMS test.',
    guardianPhone: '0712345678',
    ...overrides,
  };
}

type RepoMocks = {
  claimPendingOutboxEvents: ReturnType<typeof vi.fn>;
  rescheduleOutboxEvent: ReturnType<typeof vi.fn>;
  getOutboxSendContext: ReturnType<typeof vi.fn>;
  completeSend: ReturnType<typeof vi.fn>;
};

function makeRepo(
  claimed: ReadonlyArray<ClaimedOutboxEvent>,
  context: Record<string, unknown> | null,
): { repo: NotificationsRepository; mocks: RepoMocks } {
  const mocks: RepoMocks = {
    claimPendingOutboxEvents: vi.fn().mockResolvedValue(claimed),
    rescheduleOutboxEvent: vi.fn().mockResolvedValue(true),
    getOutboxSendContext: vi.fn().mockResolvedValue(context),
    completeSend: vi.fn().mockResolvedValue({
      deliveryId: 'd1',
      requestStatus: 'succeeded',
      deliveryStatus: 'sent',
    }),
  };
  const repo = mocks as unknown as NotificationsRepository;
  return { repo, mocks };
}

function makeSms(impl: {
  send?: ReturnType<typeof vi.fn>;
  providerCode?: string;
}): SmsProviderPort {
  return {
    providerCode: impl.providerCode ?? 'fake',
    send: (impl.send ?? vi.fn()) as unknown as SmsProviderPort['send'],
  };
}

describe('SmsOutboxWorker.runOnce', () => {
  it('sends and records a successful delivery', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext());
    const send = vi.fn().mockResolvedValue({
      providerCode: 'fake',
      providerMessageId: 'msg_1',
      status: 'sent',
    });
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await expect(worker.runOnce()).resolves.toBe(1);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        requestId: event.requestId,
        toE164: '255712345678',
        body: 'Shule: EduCore SMS test.',
      }),
    );
    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: event.requestId,
        deliveryStatus: 'sent',
        destE164: '255712345678',
        phoneLast4: '5678',
        providerMessageId: 'msg_1',
      }),
    );
    expect(mocks.rescheduleOutboxEvent).not.toHaveBeenCalled();
  });

  it('reschedules with backoff on retryable provider failure', async () => {
    const event = makeEvent({ attempts: 1 });
    const { repo, mocks } = makeRepo([event], makeContext());
    const send = vi.fn().mockResolvedValue({
      providerCode: 'fake',
      providerMessageId: 'msg_2',
      status: 'failed',
      errorCode: 'HTTP_503',
      errorMessage: 'Beem send failed (HTTP 503).',
    });
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(mocks.rescheduleOutboxEvent).toHaveBeenCalledWith({
      tenantId,
      eventId: event.eventId,
      delaySeconds: 30,
      error: 'Beem send failed (HTTP 503).',
    });
    expect(mocks.completeSend).not.toHaveBeenCalled();
  });

  it('reschedules with growing backoff as attempts accumulate', async () => {
    const event = makeEvent({ attempts: 3 });
    const { repo, mocks } = makeRepo([event], makeContext());
    const send = vi.fn().mockRejectedValue(new Error('connection reset'));
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(mocks.rescheduleOutboxEvent).toHaveBeenCalledWith(
      expect.objectContaining({ delaySeconds: 600, error: 'connection reset' }),
    );
  });

  it('fails terminally on non-retryable provider errors', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext());
    const send = vi.fn().mockResolvedValue({
      providerCode: 'beem',
      providerMessageId: 'msg_3',
      status: 'failed',
      errorCode: 'BEEM_NOT_CONFIGURED',
      errorMessage: 'Beem secrets missing.',
    });
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: 'failed',
        errorCode: 'BEEM_NOT_CONFIGURED',
      }),
    );
    expect(mocks.rescheduleOutboxEvent).not.toHaveBeenCalled();
  });

  it('dead-letters without sending once max attempts are exhausted', async () => {
    const event = makeEvent({ attempts: 5 });
    const { repo, mocks } = makeRepo([event], makeContext());
    const send = vi.fn();
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(send).not.toHaveBeenCalled();
    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: 'failed',
        errorCode: 'MAX_ATTEMPTS_EXCEEDED',
      }),
    );
    expect(mocks.rescheduleOutboxEvent).not.toHaveBeenCalled();
  });

  it('fails terminally with INVALID_PHONE without sending', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext({ guardianPhone: 'abc' }));
    const send = vi.fn();
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(send).not.toHaveBeenCalled();
    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: 'failed',
        errorCode: 'INVALID_PHONE',
      }),
    );
  });

  it('fails terminally with TEMPLATE_MISSING without sending', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext({ templateBody: null }));
    const send = vi.fn();
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await worker.runOnce();

    expect(send).not.toHaveBeenCalled();
    expect(mocks.completeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: 'failed',
        errorCode: 'TEMPLATE_MISSING',
      }),
    );
  });

  it('skips events whose request is no longer queued', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext({ status: 'succeeded' }));
    const send = vi.fn();
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await expect(worker.runOnce()).resolves.toBe(1);

    expect(send).not.toHaveBeenCalled();
    expect(mocks.completeSend).not.toHaveBeenCalled();
    expect(mocks.rescheduleOutboxEvent).not.toHaveBeenCalled();
  });

  it('survives a 55000 race when the request completed concurrently', async () => {
    const event = makeEvent();
    const { repo, mocks } = makeRepo([event], makeContext());
    mocks.completeSend.mockRejectedValue(
      Object.assign(new Error('request not sendable'), { code: '55000' }),
    );
    const send = vi.fn().mockResolvedValue({
      providerCode: 'fake',
      providerMessageId: 'msg_4',
      status: 'sent',
    });
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await expect(worker.runOnce()).resolves.toBe(1);
    expect(mocks.rescheduleOutboxEvent).not.toHaveBeenCalled();
  });

  it('continues the batch when one event fails', async () => {
    const first = makeEvent({ eventId: '01900000-0000-7000-8000-0000000000e1' });
    const second = makeEvent({
      eventId: '01900000-0000-7000-8000-0000000000e2',
      requestId: '01900000-0000-7000-8000-0000000000r2',
    });
    const { repo, mocks } = makeRepo([first, second], null);
    mocks.getOutboxSendContext
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(makeContext({ requestId: second.requestId }));
    const send = vi.fn().mockResolvedValue({
      providerCode: 'fake',
      providerMessageId: 'msg_5',
      status: 'sent',
    });
    const worker = new SmsOutboxWorker(repo, makeSms({ send }), null, config);

    await expect(worker.runOnce()).resolves.toBe(2);

    expect(send).toHaveBeenCalledOnce();
    expect(mocks.completeSend).toHaveBeenCalledOnce();
  });
});

describe('outbox worker config', () => {
  it('uses safe defaults', () => {
    const config = loadOutboxWorkerConfig({});
    expect(config).toEqual({
      enabled: true,
      pollMs: 5_000,
      batchSize: 10,
      claimSeconds: 120,
      maxAttempts: 5,
    });
  });

  it('disables via SMS_OUTBOX_WORKER_ENABLED=false and clamps bounds', () => {
    expect(loadOutboxWorkerConfig({ SMS_OUTBOX_WORKER_ENABLED: 'false' }).enabled).toBe(false);
    expect(loadOutboxWorkerConfig({ SMS_OUTBOX_POLL_MS: '10' }).pollMs).toBe(1_000);
    expect(loadOutboxWorkerConfig({ SMS_OUTBOX_BATCH: '999' }).batchSize).toBe(100);
    expect(loadOutboxWorkerConfig({ SMS_OUTBOX_MAX_ATTEMPTS: '0' }).maxAttempts).toBe(1);
  });

  it('escalates backoff per failed attempt', () => {
    expect(backoffSecondsForAttempt(1)).toBe(30);
    expect(backoffSecondsForAttempt(2)).toBe(120);
    expect(backoffSecondsForAttempt(3)).toBe(600);
    expect(backoffSecondsForAttempt(4)).toBe(1_800);
    expect(backoffSecondsForAttempt(9)).toBe(1_800);
  });
});
