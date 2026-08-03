/**
 * Notifications persistence (COMMS-003 / DBF-013 / ACF-014).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type NotificationTemplateRow = {
  readonly id: string;
  readonly code: string;
  readonly channel: string;
  readonly locale: string;
  readonly version: number;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
};

export type NotificationRequestRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly templateCode: string;
  readonly templateVersion: number;
  readonly locale: string;
  readonly channel: string;
  readonly recipientType: string;
  readonly recipientId: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly status: string;
  readonly skipReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateNotificationRequestResult = NotificationRequestRow & {
  readonly destE164: string | null;
  readonly phoneLast4: string | null;
};

export type NotificationDeliveryRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly providerCode: string;
  readonly providerMessageId: string | null;
  readonly phoneLast4: string | null;
  readonly status: string;
  readonly segmentCount: number | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

@Injectable()
export class NotificationsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listActiveTemplates(
    actorUserId: string,
    tenantId: string,
  ): Promise<ReadonlyArray<NotificationTemplateRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return [];
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{
            id: string;
            code: string;
            channel: string;
            locale: string;
            version: number;
            body: string;
            status: string;
            created_at: Date;
          }>(
            `SELECT id, code, channel, locale, version, body, status, created_at
           FROM notification_templates
           WHERE status = 'active'
             AND (tenant_id IS NULL OR tenant_id = $1::uuid)
           ORDER BY code ASC, locale ASC, version DESC`,
            [tenantId],
          );
          return result.rows.map((row) => ({
            id: row.id,
            code: row.code,
            channel: row.channel,
            locale: row.locale,
            version: row.version,
            body: row.body,
            status: row.status,
            createdAt: row.created_at.toISOString(),
          }));
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'NotificationsRepository', error, {
        operation: 'listActiveTemplates',
      });
      return [];
    }
  }

  async getTemplateBody(
    actorUserId: string,
    tenantId: string,
    code: string,
    locale: string,
    version: number,
  ): Promise<string | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return null;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<{ body: string }>(
            `SELECT body FROM notification_templates
           WHERE code = $1 AND locale = $2 AND version = $3 AND channel = 'sms' AND status = 'active'
             AND (tenant_id IS NULL OR tenant_id = $4::uuid)
           ORDER BY tenant_id NULLS LAST
           LIMIT 1`,
            [code, locale, version, tenantId],
          );
          return result.rows[0]?.body ?? null;
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'NotificationsRepository', error, {
        operation: 'getTemplateBody',
      });
      return null;
    }
  }

  async createRequest(input: {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly requestId: string;
    readonly templateCode: string;
    readonly locale: string;
    readonly recipientId: string;
    readonly payloadJson: string;
    readonly idempotencyKey: string;
    readonly dailyCap: number;
    readonly outboxId: string;
  }): Promise<CreateNotificationRequestResult> {
    if (this.pool === null) throw new Error('pool unavailable');
    const client = await this.pool.connect();
    try {
      const result = await client.query<CreateRequestDbRow>(
        `SELECT * FROM app.create_notification_request(
          $1::uuid, $2::uuid, $3::uuid, $4, $5, 'guardian', $6::uuid,
          $7::jsonb, $8, $9, $10::uuid
        )`,
        [
          input.actorUserId,
          input.tenantId,
          input.requestId,
          input.templateCode,
          input.locale,
          input.recipientId,
          input.payloadJson,
          input.idempotencyKey,
          input.dailyCap,
          input.outboxId,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('create_notification_request returned no row');
      return mapCreateResult(row);
    } finally {
      client.release();
    }
  }

  async completeSend(input: {
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly requestId: string;
    readonly deliveryId: string;
    readonly providerCode: string;
    readonly providerMessageId: string;
    readonly destE164: string;
    readonly phoneLast4: string;
    readonly deliveryStatus: 'sent' | 'failed' | 'submitted';
    readonly segmentCount: number;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
  }): Promise<{
    readonly deliveryId: string;
    readonly requestStatus: string;
    readonly deliveryStatus: string;
  }> {
    if (this.pool === null) throw new Error('pool unavailable');
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        delivery_id: string;
        request_status: string;
        delivery_status: string;
      }>(
        `SELECT * FROM app.complete_notification_send(
          $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12
        )`,
        [
          input.actorUserId,
          input.tenantId,
          input.requestId,
          input.deliveryId,
          input.providerCode,
          input.providerMessageId,
          input.destE164,
          input.phoneLast4,
          input.deliveryStatus,
          input.segmentCount,
          input.errorCode,
          input.errorMessage,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('complete_notification_send returned no row');
      return {
        deliveryId: row.delivery_id,
        requestStatus: row.request_status,
        deliveryStatus: row.delivery_status,
      };
    } finally {
      client.release();
    }
  }

  async getRequest(
    actorUserId: string,
    tenantId: string,
    requestId: string,
  ): Promise<NotificationRequestRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(requestId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<RequestDbRow>(
            `SELECT id, tenant_id, template_code, template_version, locale, channel,
                  recipient_type, recipient_id, payload_json, status, skip_reason,
                  created_at, updated_at
           FROM notification_requests
           WHERE tenant_id = $1::uuid AND id = $2::uuid
           LIMIT 1`,
            [tenantId, requestId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapRequest(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'NotificationsRepository', error, {
        operation: 'getRequest',
      });
      return null;
    }
  }

  async listDeliveries(
    actorUserId: string,
    tenantId: string,
    limit: number,
  ): Promise<ReadonlyArray<NotificationDeliveryRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) return [];
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<DeliveryDbRow>(
            `SELECT id, tenant_id, request_id, provider_code, provider_message_id,
                  phone_last4, status, segment_count, error_code, created_at, updated_at
           FROM notification_deliveries
           WHERE tenant_id = $1::uuid
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
            [tenantId, safeLimit],
          );
          return result.rows.map(mapDelivery);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'NotificationsRepository', error, {
        operation: 'listDeliveries',
      });
      return [];
    }
  }

  /** COMMS-004: Beem DLR ingest (no membership; SECURITY DEFINER). */
  async applyBeemDeliveryReport(input: {
    readonly providerMessageId: string;
    readonly deliveryStatus: string;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
  }): Promise<{
    readonly deliveryId: string | null;
    readonly tenantId: string | null;
    readonly requestId: string | null;
    readonly updated: boolean;
    readonly detail: string;
  }> {
    if (this.pool === null) throw new Error('database unavailable');
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        delivery_id: string | null;
        tenant_id: string | null;
        request_id: string | null;
        updated: boolean;
        detail: string;
      }>(
        `SELECT delivery_id, tenant_id, request_id, updated, detail
         FROM app.apply_beem_delivery_report($1::text, $2::text, $3::text, $4::text)`,
        [input.providerMessageId, input.deliveryStatus, input.errorCode, input.errorMessage],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('apply_beem_delivery_report returned no row');
      return {
        deliveryId: row.delivery_id,
        tenantId: row.tenant_id,
        requestId: row.request_id,
        updated: row.updated,
        detail: row.detail,
      };
    } finally {
      client.release();
    }
  }
}

type CreateRequestDbRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  template_code: string;
  template_version: number;
  locale: string;
  channel: string;
  recipient_type: string;
  recipient_id: string;
  payload_json: Record<string, unknown> | string;
  status: string;
  skip_reason: string | null;
  dest_e164: string | null;
  phone_last4: string | null;
  created_at: Date;
  updated_at: Date;
};

type RequestDbRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  template_code: string;
  template_version: number;
  locale: string;
  channel: string;
  recipient_type: string;
  recipient_id: string;
  payload_json: Record<string, unknown> | string;
  status: string;
  skip_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type DeliveryDbRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  request_id: string;
  provider_code: string;
  provider_message_id: string | null;
  phone_last4: string | null;
  status: string;
  segment_count: number | null;
  error_code: string | null;
  created_at: Date;
  updated_at: Date;
};

function parsePayload(raw: Record<string, unknown> | string): Readonly<Record<string, string>> {
  const obj = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : raw;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function mapCreateResult(row: CreateRequestDbRow): CreateNotificationRequestResult {
  return {
    ...mapRequest(row),
    destE164: row.dest_e164,
    phoneLast4: row.phone_last4,
  };
}

function mapRequest(row: RequestDbRow | CreateRequestDbRow): NotificationRequestRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateCode: row.template_code,
    templateVersion: Number(row.template_version),
    locale: row.locale,
    channel: row.channel,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id,
    payload: parsePayload(row.payload_json),
    status: row.status,
    skipReason: row.skip_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapDelivery(row: DeliveryDbRow): NotificationDeliveryRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    requestId: row.request_id,
    providerCode: row.provider_code,
    providerMessageId: row.provider_message_id,
    phoneLast4: row.phone_last4,
    status: row.status,
    segmentCount: row.segment_count,
    errorCode: row.error_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
