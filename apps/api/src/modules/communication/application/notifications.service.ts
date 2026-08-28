/**
 * Notification requests + SMS send path (COMMS-003…005 / ACF-014).
 */
import { randomUUID, timingSafeEqual } from 'node:crypto';

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
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { loadBeemWebhookSecret } from '../providers/beem-config.js';
import {
  NotificationsRepository,
  type NotificationDeliveryRow,
  type NotificationRequestRow,
  type NotificationTemplateRow,
} from '../repositories/notifications.repository.js';
import { assertPayloadAllowlist, TEMPLATE_ALLOWLISTS } from './notification-templates.js';

const CREATE_ROUTE = '/api/v1/notifications/requests';
const DELIVERY_STATUSES = new Set(['queued', 'submitted', 'sent', 'delivered', 'failed']);

/** Daily cap; -1 means bypass (SMS_BYPASS_DAILY_CAP=true). */
function dailyCapFromEnv(): number {
  const bypass = (process.env['SMS_BYPASS_DAILY_CAP'] ?? '').trim().toLowerCase();
  if (bypass === '1' || bypass === 'true' || bypass === 'yes') return -1;
  const raw = process.env['SMS_DAILY_CAP_PER_TENANT']?.trim();
  if (raw === undefined || raw === '') return 500;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 500;
}

function utcTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
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
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly requestId?: unknown;
      readonly status?: unknown;
    },
  ): Promise<PaginatedResponse<NotificationDeliveryRow>> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const pagination = parsePaginationQuery(rawQuery);
    const requestId = parseOptionalUuid(rawQuery.requestId, 'requestId');
    const status = parseOptionalDeliveryStatus(rawQuery.status);
    if (!this.notifications.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.notifications.listDeliveries(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      requestId,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getUsageForTenant(
    actorUserId: string,
    tenantId: string,
    dateQuery: unknown,
  ): Promise<{
    readonly data: {
      readonly usageDate: string;
      readonly channel: string;
      readonly sentCount: number;
      readonly segmentCount: number;
      readonly dailyCap: number | null;
      readonly bypassDailyCap: boolean;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const usageDate = parseUsageDate(dateQuery);
    const cap = dailyCapFromEnv();
    const bypassDailyCap = cap < 0;
    if (!this.notifications.isAvailable()) {
      return {
        data: {
          usageDate,
          channel: 'sms',
          sentCount: 0,
          segmentCount: 0,
          dailyCap: bypassDailyCap ? null : cap,
          bypassDailyCap,
        },
      };
    }
    const row = await this.notifications.getUsageDaily(actorUserId, tenantId, usageDate);
    return {
      data: {
        usageDate: row?.usageDate ?? usageDate,
        channel: 'sms',
        sentCount: row?.sentCount ?? 0,
        segmentCount: row?.segmentCount ?? 0,
        dailyCap: bypassDailyCap ? null : cap,
        bypassDailyCap,
      },
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

    // COMMS-006: sending is asynchronous. The outbox worker drains
    // notification.send_requested events with claim locking, retry/backoff,
    // and dead-lettering; delivery status is observable via
    // GET /notifications/requests/:id and the deliveries feed.
    const { destE164: _destE164, phoneLast4: _phoneLast4, ...request } = created;
    return { data: request };
  }

  /**
   * COMMS-004: public Beem DLR webhook — shared secret header, no session.
   * Header: X-Beem-Webhook-Secret must match BEEM_WEBHOOK_SECRET.
   * Body allowlist: request_id (Beem), status (DELIVERED|UNDELIVERED|FAILED|PENDING|sent|…).
   */
  async handleBeemWebhook(
    rawBody: unknown,
    webhookSecretHeader: string | undefined,
  ): Promise<{
    readonly data: {
      readonly accepted: boolean;
      readonly updated: boolean;
      readonly detail: string;
      readonly deliveryId: string | null;
    };
  }> {
    const expected = loadBeemWebhookSecret();
    if (expected === null) {
      throw new AppError(
        'NOT_IMPLEMENTED',
        'Beem webhook is not configured (set BEEM_WEBHOOK_SECRET).',
      );
    }
    if (!secureSecretEqual(webhookSecretHeader, expected)) {
      throw AppError.unauthorized('Invalid Beem webhook secret.');
    }
    if (!this.notifications.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Notifications store unavailable.');
    }
    if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw AppError.validation('Body must be a JSON object.');
    }
    const payload = rawBody as Record<string, unknown>;
    const providerMessageId = readStringField(payload, ['request_id', 'providerMessageId']);
    if (providerMessageId === null) {
      throw AppError.validation('request_id is required.', { field: 'request_id' });
    }
    const statusRaw = readStringField(payload, ['status', 'delivery_status']);
    if (statusRaw === null) {
      throw AppError.validation('status is required.', { field: 'status' });
    }
    const errorCode = readStringField(payload, ['error_code', 'errorCode']);
    const errorMessage = readStringField(payload, ['error_message', 'errorMessage', 'message']);

    try {
      const result = await this.notifications.applyBeemDeliveryReport({
        providerMessageId,
        deliveryStatus: statusRaw,
        errorCode,
        errorMessage,
      });
      if (result.detail === 'delivery_not_found') {
        throw AppError.notFound('Notification delivery not found for Beem request_id.');
      }
      return {
        data: {
          accepted: true,
          updated: result.updated,
          detail: result.detail,
          deliveryId: result.deliveryId,
        },
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError('INTERNAL_ERROR', 'Failed to apply Beem delivery report.');
    }
  }
}

function readStringField(
  payload: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function secureSecretEqual(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw.trim())) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw.trim().toLowerCase();
}

function parseOptionalDeliveryStatus(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    throw AppError.validation('status must be a string.', { field: 'status' });
  }
  const status = raw.trim().toLowerCase();
  if (!DELIVERY_STATUSES.has(status)) {
    throw AppError.validation('status is not a valid delivery status.', { field: 'status' });
  }
  return status;
}

function parseUsageDate(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return utcTodayDateString();
  if (typeof raw !== 'string') {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw AppError.validation('date must be a valid calendar day.', { field: 'date' });
  }
  return trimmed;
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

/** Exported for unit tests that need the service without Nest. */
export function createNotificationsServiceForTest(
  repo: NotificationsRepository,
  idempotency: IdempotencyStore | null = null,
): NotificationsService {
  return new NotificationsService(repo, idempotency);
}
