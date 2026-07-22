/**
 * Manual payments + receipts (IMP-009 / DBF-012). SELECT via RLS; writes via
 * SECURITY DEFINER helper (app.post_manual_payment) which posts the cash
 * journal, allocates the invoice, and issues the receipt in one transaction.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withTenantTransaction } from '../../../common/persistence/tenant-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

/** ACF-012 Payment allowlist. */
export type PaymentRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly receiptId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** ACF-012 Receipt allowlist. */
export type ReceiptRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly paymentAttemptId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly issuedAt: string;
};

export type PostManualPaymentInput = {
  readonly paymentId: string;
  readonly receiptId: string;
  readonly invoiceId: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
};

export type ListReceiptsQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
};

export type RecordGatewayEventInput = {
  readonly id: string;
  readonly providerCode: string;
  readonly providerEventId: string;
  readonly payloadSha256: string;
  readonly paymentAttemptId: string | null;
};

export type RecordGatewayEventResult = {
  readonly id: string;
  readonly inserted: boolean;
};

const PAYMENT_SELECT = `
  SELECT pa.id, pa.tenant_id, pa.invoice_id, pa.method, pa.amount_minor, pa.currency, pa.status,
         r.id AS receipt_id, pa.created_at, pa.updated_at
  FROM payment_attempts pa
  LEFT JOIN receipts r ON r.payment_attempt_id = pa.id`;

type PaymentDbRow = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  method: string;
  amount_minor: string | number;
  currency: string;
  status: string;
  receipt_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type PostManualPaymentDbRow = PaymentDbRow & {
  receipt_number: string;
};

type ReceiptDbRow = {
  id: string;
  tenant_id: string;
  payment_attempt_id: string;
  receipt_number: string;
  status: string;
  issued_at: Date;
};

@Injectable()
export class PaymentAttemptsRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async postManualPayment(
    actorUserId: string,
    tenantId: string,
    input: PostManualPaymentInput,
  ): Promise<PaymentRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<PostManualPaymentDbRow>(
        `SELECT id, tenant_id, invoice_id, method, amount_minor, currency, status,
                created_at, updated_at, receipt_id, receipt_number
         FROM app.post_manual_payment(
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::text, $7::bigint, $8::text
         )`,
        [
          actorUserId,
          tenantId,
          input.paymentId,
          input.receiptId,
          input.invoiceId,
          input.method,
          input.amountMinor,
          input.currency,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('post_manual_payment returned no row');
      return mapPayment(row);
    });
  }

  /** Wave D / DBF-012 rev 1.1: reverses the payment journal and recomputes invoice status. */
  async reversePayment(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
  ): Promise<PaymentRow> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<PaymentDbRow>(
        `SELECT id, tenant_id, invoice_id, method, amount_minor, currency, status,
                created_at, updated_at, receipt_id
         FROM app.reverse_payment($1::uuid, $2::uuid, $3::uuid)`,
        [actorUserId, tenantId, paymentId],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('reverse_payment returned no row');
      return mapPayment(row);
    });
  }

  /** Wave G / DBF-012 rev 1.2: dedupes gateway events on (tenant, provider, event id). */
  async recordGatewayEvent(
    actorUserId: string,
    tenantId: string,
    input: RecordGatewayEventInput,
  ): Promise<RecordGatewayEventResult> {
    if (this.pool === null) throw new Error('database unavailable');
    return withTenantTransaction(this.pool, { userId: actorUserId, tenantId }, async (client) => {
      const result = await client.query<{ id: string; inserted: boolean }>(
        `SELECT id, inserted FROM app.record_gateway_event(
           $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text, $7::uuid
         )`,
        [
          actorUserId,
          tenantId,
          input.id,
          input.providerCode,
          input.providerEventId,
          input.payloadSha256,
          input.paymentAttemptId,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('record_gateway_event returned no row');
      return { id: row.id, inserted: row.inserted };
    });
  }

  async getPayment(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
  ): Promise<PaymentRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(paymentId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<PaymentDbRow>(
            `${PAYMENT_SELECT} WHERE pa.tenant_id = $1::uuid AND pa.id = $2::uuid LIMIT 1`,
            [tenantId, paymentId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapPayment(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PaymentAttemptsRepository', error, {
        operation: 'getPayment',
      });
      return null;
    }
  }

  async listPaymentsByInvoice(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<ReadonlyArray<PaymentRow>> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(invoiceId) || this.pool === null) {
      return [];
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<PaymentDbRow>(
            `${PAYMENT_SELECT}
             WHERE pa.tenant_id = $1::uuid AND pa.invoice_id = $2::uuid
             ORDER BY pa.created_at DESC, pa.id ASC`,
            [tenantId, invoiceId],
          );
          return result.rows.map(mapPayment);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PaymentAttemptsRepository', error, {
        operation: 'listPaymentsByInvoice',
      });
      return [];
    }
  }

  async listReceipts(
    actorUserId: string,
    tenantId: string,
    query: ListReceiptsQuery,
  ): Promise<{ readonly rows: ReadonlyArray<ReceiptRow>; readonly nextCursor: string | null }> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || this.pool === null) {
      return { rows: [], nextCursor: null };
    }
    if (query.cursor !== undefined && !isUuid(query.cursor)) {
      return { rows: [], nextCursor: null };
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const params: unknown[] = [tenantId, query.limit + 1];
          let sql = `
            SELECT id, tenant_id, payment_attempt_id, receipt_number, status, issued_at
            FROM receipts
            WHERE tenant_id = $1::uuid`;
          if (query.cursor !== undefined) {
            params.push(query.cursor);
            sql += `
              AND EXISTS (
                SELECT 1 FROM receipts cur
                WHERE cur.id = $${String(params.length)}::uuid AND cur.tenant_id = $1::uuid
                  AND (
                    receipts.issued_at < cur.issued_at
                    OR (receipts.issued_at = cur.issued_at AND receipts.id > cur.id)
                  )
              )`;
          }
          sql += ` ORDER BY issued_at DESC, id ASC LIMIT $2`;
          const result = await client.query<ReceiptDbRow>(sql, params);
          const hasMore = result.rows.length > query.limit;
          const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
          const mapped = page.map(mapReceipt);
          const last = mapped[mapped.length - 1];
          return { rows: mapped, nextCursor: hasMore && last !== undefined ? last.id : null };
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PaymentAttemptsRepository', error, {
        operation: 'listReceipts',
      });
      return { rows: [], nextCursor: null };
    }
  }

  async getReceipt(
    actorUserId: string,
    tenantId: string,
    receiptId: string,
  ): Promise<ReceiptRow | null> {
    if (!isUuid(actorUserId) || !isUuid(tenantId) || !isUuid(receiptId) || this.pool === null) {
      return null;
    }
    try {
      return await withTenantTransaction(
        this.pool,
        { userId: actorUserId, tenantId },
        async (client) => {
          const result = await client.query<ReceiptDbRow>(
            `SELECT id, tenant_id, payment_attempt_id, receipt_number, status, issued_at
             FROM receipts WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
            [tenantId, receiptId],
          );
          const row = result.rows[0];
          return row === undefined ? null : mapReceipt(row);
        },
      );
    } catch (error: unknown) {
      logFailClosedDbError(this.logger, 'PaymentAttemptsRepository', error, {
        operation: 'getReceipt',
      });
      return null;
    }
  }
}

function mapPayment(row: PaymentDbRow): PaymentRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    invoiceId: row.invoice_id,
    method: row.method,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    receiptId: row.receipt_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapReceipt(row: ReceiptDbRow): ReceiptRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    paymentAttemptId: row.payment_attempt_id,
    receiptNumber: row.receipt_number,
    status: row.status,
    issuedAt: row.issued_at.toISOString(),
  };
}
