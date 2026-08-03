/**
 * Notification requests + Fake SMS send path (COMMS-003 / ACF-014).
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  IDEMPOTENCY_STORE,
  resolveIdempotentReplay,
  type IdempotencyStore,
} from '../../../common/idempotency/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  assertPayloadAllowlist,
  normalizeTzMsisdn,
  phoneLast4,
  renderTemplateBody,
  TEMPLATE_ALLOWLISTS,
} from './notification-templates.js';
import { FakeSmsProvider } from '../providers/fake-sms.provider.js';
import { SMS_PROVIDER_PORT, type SmsProviderPort } from '../providers/sms-provider.port.js';
import {
  NotificationsRepository,
  type NotificationDeliveryRow,
  type NotificationRequestRow,
  type NotificationTemplateRow,
} from '../repositories/notifications.repository.js';

const CREATE_ROUTE = '/api/v1/notifications/requests';

function dailyCapFromEnv(): number {
  const raw = process.env['SMS_DAILY_CAP_PER_TENANT']?.trim();
  if (raw === undefined || raw === '') return 500;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 500;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    @Inject(SMS_PROVIDER_PORT) private readonly sms: SmsProviderPort,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
  ) {}

  async listTemplatesForTenant(
    actorUserId: string,
    tenantId: string,
  ): Promise<{ readonly data: ReadonlyArray<NotificationTemplateRow> }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.notifications.isAvailable()) return { data: [] };
    return { data: await this.notifications.listActiveTemplates(actorUserId, tenantId) };
  }

  async getRequestForTenant(
    actorUserId: string,
    tenantId: string,
    requestId: string,
  ): Promise<{ readonly data: NotificationRequestRow }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(requestId)) throw AppError.notFound('Notification request not found.');
    if (!this.notifications.isAvailable()) {
      throw AppError.notFound('Notification request not found.');
    }
    const row = await this.notifications.getRequest(actorUserId, tenantId, requestId);
    if (row === null) throw AppError.notFound('Notification request not found.');
    return { data: row };
  }

  async listDeliveriesForTenant(
    actorUserId: string,
    tenantId: string,
    limit?: number,
  ): Promise<{ readonly data: ReadonlyArray<NotificationDeliveryRow> }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.notifications.isAvailable()) return { data: [] };
    return {
      data: await this.notifications.listDeliveries(actorUserId, tenantId, limit ?? 25),
    };
  }

  async createRequestForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    _correlationId: string,
  ): Promise<{ readonly data: NotificationRequestRow }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.notifications.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Notifications store unavailable.');
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: CREATE_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as { data: NotificationRequestRow };
      }

      const result = await this.executeCreate(actorUserId, tenantId, parsed, key);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreate(actorUserId, tenantId, parsed, key);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: ParsedCreateRequest,
    idempotencyKey: string,
  ): Promise<{ readonly data: NotificationRequestRow }> {
    try {
      assertPayloadAllowlist(parsed.templateCode, parsed.payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid payload.';
      throw AppError.validation(message);
    }

    const requestId = randomUUID();
    const outboxId = randomUUID();

    let created;
    try {
      created = await this.notifications.createRequest({
        actorUserId,
        tenantId,
        requestId,
        templateCode: parsed.templateCode,
        locale: parsed.locale,
        recipientId: parsed.recipientId,
        payloadJson: JSON.stringify(parsed.payload),
        idempotencyKey,
        dailyCap: dailyCapFromEnv(),
        outboxId,
      });
    } catch (error: unknown) {
      throw mapPgCreateError(error);
    }

    if (created.status !== 'queued' || created.destE164 === null) {
      const { destE164: _d, phoneLast4: _p, ...request } = created;
      return { data: request };
    }

    const normalized = normalizeTzMsisdn(created.destE164);
    if (normalized === null) {
      try {
        await this.notifications.completeSend({
          actorUserId,
          tenantId,
          requestId: created.id,
          deliveryId: randomUUID(),
          providerCode: this.sms.providerCode,
          providerMessageId: `invalid_phone_${created.id}`,
          destE164: created.destE164,
          phoneLast4: created.phoneLast4 ?? phoneLast4(created.destE164),
          deliveryStatus: 'failed',
          segmentCount: 1,
          errorCode: 'INVALID_PHONE',
          errorMessage: 'Guardian phone could not be normalized to E.164.',
        });
      } catch {
        // fall through to reload
      }
      const failed = await this.notifications.getRequest(actorUserId, tenantId, created.id);
      if (failed === null) throw new AppError('INTERNAL_ERROR', 'Failed to finalize notification.');
      return { data: failed };
    }

    const bodyTemplate = await this.notifications.getTemplateBody(
      actorUserId,
      tenantId,
      created.templateCode,
      created.locale,
      created.templateVersion,
    );
    if (bodyTemplate === null) {
      throw new AppError('INTERNAL_ERROR', 'Template body missing after create.');
    }
    const body = renderTemplateBody(bodyTemplate, parsed.payload);

    const sendResult = await this.sms.send({
      tenantId,
      requestId: created.id,
      toE164: normalized,
      body,
      clientRef: created.id,
    });

    try {
      await this.notifications.completeSend({
        actorUserId,
        tenantId,
        requestId: created.id,
        deliveryId: randomUUID(),
        providerCode: sendResult.providerCode,
        providerMessageId: sendResult.providerMessageId,
        destE164: normalized,
        phoneLast4: phoneLast4(normalized),
        deliveryStatus: sendResult.status === 'sent' ? 'sent' : 'failed',
        segmentCount: 1,
        errorCode: sendResult.errorCode ?? null,
        errorMessage: sendResult.errorMessage ?? null,
      });
    } catch (error: unknown) {
      throw mapPgCreateError(error);
    }

    const finalRow = await this.notifications.getRequest(actorUserId, tenantId, created.id);
    if (finalRow === null)
      throw new AppError('INTERNAL_ERROR', 'Failed to load notification request.');
    return { data: finalRow };
  }
}

type ParsedCreateRequest = {
  readonly templateCode: string;
  readonly locale: string;
  readonly recipientType: 'guardian';
  readonly recipientId: string;
  readonly payload: Readonly<Record<string, string>>;
};

function parseCreateRequest(raw: unknown): ParsedCreateRequest {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['templateCode', 'locale', 'recipientType', 'recipientId', 'payload']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['templateCode'] !== 'string' || !(body['templateCode'] in TEMPLATE_ALLOWLISTS)) {
    throw AppError.validation('templateCode is required and must be a known catalog code.', {
      field: 'templateCode',
    });
  }
  const locale = body['locale'] === undefined ? 'sw' : body['locale'];
  if (locale !== 'en' && locale !== 'sw') {
    throw AppError.validation('locale must be en or sw.', { field: 'locale' });
  }
  if (body['recipientType'] !== undefined && body['recipientType'] !== 'guardian') {
    throw AppError.validation('recipientType must be guardian.', { field: 'recipientType' });
  }
  if (typeof body['recipientId'] !== 'string' || !isUuid(body['recipientId'])) {
    throw AppError.validation('recipientId is required and must be a UUID.', {
      field: 'recipientId',
    });
  }
  if (
    body['payload'] === null ||
    typeof body['payload'] !== 'object' ||
    Array.isArray(body['payload'])
  ) {
    throw AppError.validation('payload must be an object.', { field: 'payload' });
  }
  const payloadRaw = body['payload'] as Record<string, unknown>;
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(payloadRaw)) {
    if (typeof v !== 'string') {
      throw AppError.validation(`payload.${k} must be a string.`, { field: `payload.${k}` });
    }
    payload[k] = v;
  }

  return {
    templateCode: body['templateCode'],
    locale,
    recipientType: 'guardian',
    recipientId: body['recipientId'],
    payload,
  };
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function mapPgCreateError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isPgCode(error, 'P0002')) return AppError.notFound('Template or guardian not found.');
  if (isPgCode(error, '42501')) {
    return AppError.forbidden('Active membership required for this tenant.');
  }
  if (isPgCode(error, '23505')) {
    return new AppError('CONFLICT', 'Idempotency key already used with a different outcome.');
  }
  if (isPgCode(error, '22023')) return AppError.validation('Invalid notification request.');
  return new AppError('INTERNAL_ERROR', 'Failed to create notification request.');
}

/** Exported for unit tests that need Fake without Nest. */
export function createNotificationsServiceForTest(
  repo: NotificationsRepository,
  sms: SmsProviderPort = new FakeSmsProvider(),
  idempotency: IdempotencyStore | null = null,
): NotificationsService {
  return new NotificationsService(repo, sms, idempotency);
}
