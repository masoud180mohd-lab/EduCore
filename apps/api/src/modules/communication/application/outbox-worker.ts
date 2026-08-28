/**
 * SMS outbox worker (COMMS-006).
 * Drains `notification.send_requested` outbox events asynchronously with
 * claim locking (no double-send), exponential backoff retries, and
 * dead-lettering via app.complete_notification_send('failed', ...).
 *
 * Runs in-process behind the API (single-instance deployments); disable with
 * SMS_OUTBOX_WORKER_ENABLED=false when running dedicated worker instances.
 *
 * Note on batching: Beem accepts multiple recipients only for identical
 * message bodies, while notification bodies vary per guardian — so sends are
 * sequential per claimed event. Revisit if a same-body broadcast use case
 * lands.
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import {
  estimateSmsSegments,
  normalizeTzMsisdn,
  phoneLast4,
  renderTemplateBody,
} from './notification-templates.js';
import {
  SMS_PROVIDER_PORT,
  type SmsProviderPort,
  type SmsSendResult,
} from '../providers/sms-provider.port.js';
import {
  NotificationsRepository,
  type ClaimedOutboxEvent,
} from '../repositories/notifications.repository.js';

export type OutboxWorkerConfig = {
  readonly enabled: boolean;
  readonly pollMs: number;
  readonly batchSize: number;
  readonly claimSeconds: number;
  readonly maxAttempts: number;
};

const DEFAULTS = {
  pollMs: 5_000,
  batchSize: 10,
  claimSeconds: 120,
  maxAttempts: 5,
} as const;

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw.trim());
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function loadOutboxWorkerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OutboxWorkerConfig {
  const disabled = (environment['SMS_OUTBOX_WORKER_ENABLED'] ?? '').trim().toLowerCase();
  return {
    enabled: disabled !== 'false' && disabled !== '0' && disabled !== 'no',
    pollMs: clampInt(environment['SMS_OUTBOX_POLL_MS'], 1_000, 600_000, DEFAULTS.pollMs),
    batchSize: clampInt(environment['SMS_OUTBOX_BATCH'], 1, 100, DEFAULTS.batchSize),
    claimSeconds: clampInt(
      environment['SMS_OUTBOX_CLAIM_SECONDS'],
      10,
      3_600,
      DEFAULTS.claimSeconds,
    ),
    maxAttempts: clampInt(environment['SMS_OUTBOX_MAX_ATTEMPTS'], 1, 20, DEFAULTS.maxAttempts),
  };
}

/** Exponential backoff by failed-attempt count (post-claim): 30s, 2m, 10m, then 30m. */
export function backoffSecondsForAttempt(attempts: number): number {
  if (attempts <= 1) return 30;
  if (attempts === 2) return 120;
  if (attempts === 3) return 600;
  return 1_800;
}

/** Provider outcomes retrying cannot fix (config/input problems). */
const TERMINAL_PROVIDER_ERROR_CODES = new Set(['BEEM_NOT_CONFIGURED', 'INVALID_INPUT']);

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

@Injectable()
export class SmsOutboxWorker implements OnApplicationBootstrap {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(SMS_PROVIDER_PORT) private readonly sms: SmsProviderPort,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
    @Optional() private readonly config: OutboxWorkerConfig = loadOutboxWorkerConfig(),
  ) {}

  onApplicationBootstrap(): void {
    if (this.stopped) return;
    if (!this.config.enabled) {
      this.logger?.info('SMS outbox worker disabled by configuration.');
      return;
    }
    if (!this.repo.isAvailable()) {
      this.logger?.warn('SMS outbox worker not started: notifications store unavailable.');
      return;
    }
    this.logger?.info('SMS outbox worker started.', {
      pollMs: this.config.pollMs,
      batchSize: this.config.batchSize,
      maxAttempts: this.config.maxAttempts,
    });
    this.scheduleNext(this.config.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** One worker tick: claim a batch and attempt each send. Returns processed count. */
  async runOnce(): Promise<number> {
    const claimed = await this.repo.claimPendingOutboxEvents(
      this.config.batchSize,
      this.config.claimSeconds,
    );
    for (const event of claimed) {
      try {
        await this.processOne(event);
      } catch (error: unknown) {
        this.logger?.error('SMS outbox event processing failed.', {
          eventId: event.eventId,
          requestId: event.requestId,
          tenantId: event.tenantId,
          error: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }
    return claimed.length;
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.runOnce()
        .catch((error: unknown) => {
          this.logger?.error('SMS outbox tick failed.', {
            error: error instanceof Error ? error.message : 'unknown error',
          });
        })
        .finally(() => {
          if (!this.stopped) this.scheduleNext(this.config.pollMs);
        });
    }, delayMs);
    this.timer.unref();
  }

  private async processOne(event: ClaimedOutboxEvent): Promise<void> {
    const ctx = await this.repo.getOutboxSendContext(
      event.createdByUserId,
      event.tenantId,
      event.requestId,
    );
    if (ctx === null) {
      this.logger?.warn('SMS outbox event has no matching request; skipping.', {
        eventId: event.eventId,
        requestId: event.requestId,
        tenantId: event.tenantId,
      });
      return;
    }
    if (ctx.status !== 'queued') {
      // Completed by another path (e.g. crashed-sender recovery duplicate).
      this.logger?.info('SMS outbox event request is no longer queued; skipping.', {
        eventId: event.eventId,
        requestId: event.requestId,
        status: ctx.status,
      });
      return;
    }

    const rawPhone = ctx.guardianPhone ?? '';
    const normalized = rawPhone === '' ? null : normalizeTzMsisdn(rawPhone);
    const destE164 = normalized ?? rawPhone;
    const last4 = phoneLast4(destE164);

    // Claim already counted this attempt: dead-letter without sending.
    if (event.attempts >= this.config.maxAttempts) {
      await this.finalizeFailure(
        event,
        `max_attempts_${event.requestId}`,
        destE164,
        last4,
        'MAX_ATTEMPTS_EXCEEDED',
        `Send failed after ${String(event.attempts)} attempts.`,
        1,
      );
      return;
    }

    if (normalized === null) {
      await this.finalizeFailure(
        event,
        `invalid_phone_${event.requestId}`,
        destE164,
        last4,
        'INVALID_PHONE',
        'Guardian phone could not be normalized to E.164.',
        1,
      );
      return;
    }
    if (ctx.templateBody === null) {
      await this.finalizeFailure(
        event,
        `template_missing_${event.requestId}`,
        destE164,
        last4,
        'TEMPLATE_MISSING',
        'Pinned template body is missing or inactive.',
        1,
      );
      return;
    }

    const body = renderTemplateBody(ctx.templateBody, ctx.payload);
    const segments = estimateSmsSegments(body);

    let result: SmsSendResult;
    try {
      result = await this.sms.send({
        tenantId: event.tenantId,
        requestId: event.requestId,
        toE164: normalized,
        body,
        clientRef: event.requestId,
      });
    } catch (error: unknown) {
      await this.reschedule(
        event,
        backoffSecondsForAttempt(event.attempts),
        error instanceof Error ? error.message : 'provider error',
      );
      return;
    }

    if (result.status === 'sent') {
      await this.completeSend(
        event,
        result.providerMessageId,
        destE164,
        last4,
        'sent',
        segments,
        null,
        null,
      );
      return;
    }
    if (result.errorCode !== undefined && TERMINAL_PROVIDER_ERROR_CODES.has(result.errorCode)) {
      await this.completeSend(
        event,
        result.providerMessageId,
        destE164,
        last4,
        'failed',
        segments,
        result.errorCode,
        result.errorMessage ?? 'Provider rejected the message.',
      );
      return;
    }
    await this.reschedule(
      event,
      backoffSecondsForAttempt(event.attempts),
      result.errorMessage ?? `provider error ${result.errorCode ?? 'unknown'}`,
    );
  }

  /** Records the final failed delivery row and dead-letters the outbox event. */
  private async finalizeFailure(
    event: ClaimedOutboxEvent,
    providerMessageId: string,
    destE164: string,
    phoneLast4Value: string,
    errorCode: string,
    errorMessage: string,
    segmentCount: number,
  ): Promise<void> {
    await this.completeSend(
      event,
      providerMessageId,
      destE164,
      phoneLast4Value,
      'failed',
      segmentCount,
      errorCode,
      errorMessage,
    );
  }

  private async completeSend(
    event: ClaimedOutboxEvent,
    providerMessageId: string,
    destE164: string,
    phoneLast4Value: string,
    deliveryStatus: 'sent' | 'failed',
    segmentCount: number,
    errorCode: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.repo.completeSend({
        actorUserId: event.createdByUserId,
        tenantId: event.tenantId,
        requestId: event.requestId,
        deliveryId: randomUUID(),
        providerCode: this.sms.providerCode,
        providerMessageId,
        destE164,
        phoneLast4: phoneLast4Value,
        deliveryStatus,
        segmentCount,
        errorCode,
        errorMessage,
      });
    } catch (error: unknown) {
      if (isPgCode(error, '55000')) {
        // Request became terminal concurrently (duplicate claim recovery).
        this.logger?.info('SMS outbox send completion raced a terminal request; skipping.', {
          requestId: event.requestId,
          eventId: event.eventId,
        });
        return;
      }
      this.logger?.error('SMS outbox send completion failed; event will re-claim.', {
        requestId: event.requestId,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  private async reschedule(
    event: ClaimedOutboxEvent,
    delaySeconds: number,
    error: string,
  ): Promise<void> {
    try {
      const rescheduled = await this.repo.rescheduleOutboxEvent({
        tenantId: event.tenantId,
        eventId: event.eventId,
        delaySeconds,
        error,
      });
      this.logger?.warn('SMS send failed; outbox event rescheduled.', {
        requestId: event.requestId,
        eventId: event.eventId,
        attempts: event.attempts,
        delaySeconds,
        rescheduled,
      });
    } catch (rescheduleError: unknown) {
      this.logger?.error('SMS outbox reschedule failed; event will re-claim.', {
        requestId: event.requestId,
        eventId: event.eventId,
        error: rescheduleError instanceof Error ? rescheduleError.message : 'unknown error',
      });
    }
  }
}
