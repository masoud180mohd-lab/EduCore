/**
 * Manual payments + receipts application service (IMP-009 / ACF-012).
 * Amounts are always integer minor units — floats are rejected, never rounded.
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
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import { loadClickPesaConfig, CLICKPESA_PROVIDER_CODE } from '../providers/clickpesa-config.js';
import { verifyClickPesaPayloadChecksum } from '../providers/clickpesa-checksum.js';
import { clickPesaMajorToMinor } from '../providers/clickpesa-money.js';
import { FAKE_PROVIDER_CODE } from '../providers/fake-payment.provider.js';
import {
  PAYMENT_PROVIDER_PORT,
  type PaymentProviderPort,
} from '../providers/payment-provider.port.js';
import {
  PaymentAttemptsRepository,
  type PaymentRow,
  type ReceiptRow,
} from '../repositories/payment-attempts.repository.js';

export type Payment = PaymentRow;
export type Receipt = ReceiptRow;

export type CreatePaymentResult = { readonly data: Payment };
export type GetPaymentResult = { readonly data: Payment };
export type ReversePaymentResult = { readonly data: Payment };
export type ListPaymentsResult = { readonly data: ReadonlyArray<Payment> };
export type ListReceiptsResult = PaginatedResponse<Receipt>;
export type GetReceiptResult = { readonly data: Receipt };
export type FakeWebhookResult = {
  readonly data: { readonly accepted: true; readonly duplicate: boolean };
};
export type ClickPesaWebhookResult = {
  readonly data: {
    readonly accepted: true;
    readonly duplicate: boolean;
    readonly completed: boolean;
    readonly detail: string;
  };
};
export type SyncProviderPaymentResult = {
  readonly data: {
    readonly paymentAttemptId: string;
    readonly providerStatus: string;
    readonly completed: boolean;
    readonly detail: string;
  };
};
export type SyncPendingClickPesaResult = {
  readonly data: {
    readonly scanned: number;
    readonly completed: number;
    readonly results: ReadonlyArray<SyncProviderPaymentResult['data']>;
  };
};
export type CreateMobileMoneyResult = {
  readonly data: Payment & { readonly billPayNumber: string };
};
export type ReconcilePaymentResult = {
  readonly data: {
    readonly id: string;
    readonly tenantId: string;
    readonly paymentAttemptId: string;
    readonly gatewayEventId: string | null;
    readonly outcome: string;
    readonly attemptAmountMinor: number;
    readonly attemptStatus: string;
    readonly eventAmountMinor: number | null;
    readonly eventOutcome: string | null;
    readonly createdAt: string;
  };
};

const PAYMENT_METHODS = new Set(['cash', 'bank', 'cheque', 'other', 'mobile_money']);
const PAYMENTS_ROUTE = '/api/v1/payments';
const MOBILE_MONEY_ROUTE = '/api/v1/payments/mobile-money';
const SYNC_PROVIDER_SUFFIX = '/sync-provider';
const SYNC_PENDING_ROUTE = '/api/v1/payments/sync-provider-pending';
const REVERSE_SUFFIX = '/reverse';
const RECONCILE_SUFFIX = '/reconcile';
const WEBHOOK_OUTCOMES = new Set(['succeeded', 'failed']);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentAttemptsRepository,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly provider: PaymentProviderPort,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreatePaymentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreatePaymentRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: PAYMENTS_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreatePaymentResult;

      const result = await this.executeCreate(actorUserId, tenantId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreate(actorUserId, tenantId, parsed, correlationId);
  }

  /**
   * Wave D / DBF-012 rev 1.1. Reverse is allowed only for `succeeded`
   * payments; the SECURITY DEFINER helper posts a reversing journal, marks
   * the allocations/receipt reversed, and recomputes the invoice status.
   */
  async reverseForTenant(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<ReversePaymentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(paymentId)) throw AppError.notFound('Payment not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const route = `${PAYMENTS_ROUTE}/${paymentId}${REVERSE_SUFFIX}`;
    const bodyJson = '{}';

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as ReversePaymentResult;

      const result = await this.executeReverse(actorUserId, tenantId, paymentId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeReverse(actorUserId, tenantId, paymentId, correlationId);
  }

  /**
   * Wave R / DBF-012 rev 1.3. Compare payment attempt vs latest linked gateway
   * event and record an immutable reconciliation row. Requires finance.reconcile
   * at the controller; does not mutate ledger or payment status.
   */
  async reconcileForTenant(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<ReconcilePaymentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(paymentId)) throw AppError.notFound('Payment not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const route = `${PAYMENTS_ROUTE}/${paymentId}${RECONCILE_SUFFIX}`;
    const bodyJson = '{}';

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as ReconcilePaymentResult;

      const result = await this.executeReconcile(actorUserId, tenantId, paymentId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeReconcile(actorUserId, tenantId, paymentId, correlationId);
  }

  /**
   * PAY-005: query ClickPesa for one pending attempt and ingest (complete / fail / mismatch).
   * Independent of webhooks — bible reconciliation path.
   */
  async syncProviderForTenant(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<SyncProviderPaymentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(paymentId)) throw AppError.notFound('Payment not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const route = `${PAYMENTS_ROUTE}/${paymentId}${SYNC_PROVIDER_SUFFIX}`;
    const bodyJson = '{}';

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as SyncProviderPaymentResult;

      const result = await this.executeSyncProvider(
        actorUserId,
        tenantId,
        paymentId,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeSyncProvider(actorUserId, tenantId, paymentId, correlationId);
  }

  /**
   * PAY-005: scan pending ClickPesa attempts for the tenant and sync each via query API.
   */
  async syncPendingClickPesaForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<SyncPendingClickPesaResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const limit = parseSyncPendingLimit(rawBody);
    const bodyJson = JSON.stringify({ limit });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: SYNC_PENDING_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as SyncPendingClickPesaResult;

      const result = await this.executeSyncPending(actorUserId, tenantId, limit, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeSyncPending(actorUserId, tenantId, limit, correlationId);
  }

  /**
   * Wave G / DBF-012. Minimal Fake webhook stub: dedupes on
   * (tenant, provider, eventId) via the SECURITY DEFINER helper and reports
   * whether the event was already seen. Deliberately does not chain into a
   * payment-completion path — no gateway-initiated pending flow exists yet.
   */
  async handleFakeWebhookForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<FakeWebhookResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.payments.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Payments store unavailable.');
    }

    const parsed = parseFakeWebhookRequest(rawBody);
    const payloadSha256 = hashRequestBody(JSON.stringify(parsed));

    try {
      const result = await this.payments.recordGatewayEvent(actorUserId, tenantId, {
        id: randomUUID(),
        providerCode: FAKE_PROVIDER_CODE,
        providerEventId: parsed.eventId,
        payloadSha256,
        paymentAttemptId: parsed.paymentAttemptId,
        amountMinor: parsed.amountMinor,
        providerOutcome: parsed.outcome,
      });
      const duplicate = !result.inserted;

      await this.safeAudit({
        action: 'payment.webhook.fake',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_gateway_event',
        resourceId: result.id,
        metadata: { duplicate, outcome: parsed.outcome, eventId: parsed.eventId },
      });
      return { data: { accepted: true, duplicate } };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '42501')) {
        throw AppError.forbidden('Active membership required for this tenant.');
      }
      if (isPgCode(error, '22023')) {
        throw AppError.validation('paymentAttemptId not found in this tenant.', {
          field: 'paymentAttemptId',
        });
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to record webhook event.');
    }
  }

  /**
   * PAY-004: create pending mobile_money attempt + ClickPesa Order BillPay number.
   */
  async createMobileMoneyForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateMobileMoneyResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateMobileMoneyRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: MOBILE_MONEY_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateMobileMoneyResult;

      const result = await this.executeCreateMobileMoney(
        actorUserId,
        tenantId,
        parsed,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreateMobileMoney(actorUserId, tenantId, parsed, correlationId);
  }

  /**
   * PAY-004: public ClickPesa webhook — checksum only, no session/tenant header.
   */
  async handleClickPesaWebhook(
    rawBody: unknown,
    correlationId: string,
  ): Promise<ClickPesaWebhookResult> {
    const config = loadClickPesaConfig();
    if (config === null) {
      throw new AppError('INTERNAL_ERROR', 'ClickPesa webhook is not configured.');
    }
    if (!this.payments.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Payments store unavailable.');
    }
    if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw AppError.validation('Body must be a JSON object.');
    }
    const payload = rawBody as Record<string, unknown>;
    const checksum = payload['checksum'];
    if (typeof checksum !== 'string' || checksum.trim() === '') {
      throw AppError.unauthorized('Missing ClickPesa checksum.');
    }
    if (!verifyClickPesaPayloadChecksum(config.checksumKey, payload, checksum.trim())) {
      throw AppError.unauthorized('Invalid ClickPesa checksum.');
    }

    const parsed = parseClickPesaWebhookPayload(payload);
    const payloadSha256 = hashRequestBody(JSON.stringify(stripForHash(payload)));

    try {
      const result = await this.payments.ingestClickPesaGatewayEvent({
        gatewayEventId: randomUUID(),
        providerEventId: parsed.providerEventId,
        payloadSha256,
        orderReference: parsed.orderReference,
        amountMinor: parsed.amountMinor,
        providerOutcome: parsed.outcome,
        receiptId: randomUUID(),
      });

      if (result.detail === 'attempt_not_found') {
        throw AppError.notFound('Payment attempt not found for order reference.');
      }

      await this.safeAudit({
        action: 'payment.webhook.clickpesa',
        outcome: 'success',
        correlationId,
        actorUserId: parsed.orderReference,
        tenantId: result.tenantId ?? parsed.orderReference,
        resourceType: 'payment_gateway_event',
        resourceId: result.gatewayEventId ?? parsed.providerEventId,
        metadata: {
          duplicate: !result.inserted,
          completed: result.completed,
          detail: result.detail,
        },
      });

      return {
        data: {
          accepted: true,
          duplicate: !result.inserted,
          completed: result.completed,
          detail: result.detail,
        },
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError('INTERNAL_ERROR', 'Failed to ingest ClickPesa webhook.');
    }
  }

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
  ): Promise<GetPaymentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(paymentId)) throw AppError.notFound('Payment not found.');
    if (!this.payments.isAvailable()) throw AppError.notFound('Payment not found.');

    const row = await this.payments.getPayment(actorUserId, tenantId, paymentId);
    if (row === null) throw AppError.notFound('Payment not found.');
    return { data: row };
  }

  async listByInvoiceForTenant(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<ListPaymentsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(invoiceId)) {
      throw AppError.validation('invoiceId must be a UUID.', { field: 'invoiceId' });
    }

    if (!this.payments.isAvailable()) return { data: [] };
    const rows = await this.payments.listPaymentsByInvoice(actorUserId, tenantId, invoiceId);
    return { data: rows };
  }

  async listReceiptsForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: { readonly limit?: unknown; readonly cursor?: unknown },
  ): Promise<ListReceiptsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const pagination = parsePaginationQuery(rawQuery);
    if (!this.payments.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.payments.listReceipts(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getReceiptForTenant(
    actorUserId: string,
    tenantId: string,
    receiptId: string,
  ): Promise<GetReceiptResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(receiptId)) throw AppError.notFound('Receipt not found.');
    if (!this.payments.isAvailable()) throw AppError.notFound('Receipt not found.');

    const row = await this.payments.getReceipt(actorUserId, tenantId, receiptId);
    if (row === null) throw AppError.notFound('Receipt not found.');
    return { data: row };
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: ParsedCreatePayment,
    correlationId: string,
  ): Promise<CreatePaymentResult> {
    if (!this.payments.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Payments store unavailable.');
    }
    try {
      const row = await this.payments.postManualPayment(actorUserId, tenantId, {
        paymentId: randomUUID(),
        receiptId: randomUUID(),
        invoiceId: parsed.invoiceId,
        method: parsed.method,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
      });

      await this.safeAudit({
        action: 'payment.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_attempt',
        resourceId: row.id,
        metadata: { invoiceId: parsed.invoiceId, method: parsed.method },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapPaymentWriteError(error);
    }
  }

  private async executeCreateMobileMoney(
    actorUserId: string,
    tenantId: string,
    parsed: ParsedCreateMobileMoney,
    correlationId: string,
  ): Promise<CreateMobileMoneyResult> {
    if (!this.payments.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Payments store unavailable.');
    }
    if (this.provider.providerCode !== CLICKPESA_PROVIDER_CODE) {
      throw new AppError(
        'NOT_IMPLEMENTED',
        'Mobile money initiate requires PAYMENT_PROVIDER=clickpesa with secrets configured.',
      );
    }

    const paymentId = randomUUID();
    let initiated;
    try {
      const initiateInput = {
        tenantId,
        invoiceId: parsed.invoiceId,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        reference: paymentId,
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      };
      initiated = await this.provider.initiate(initiateInput);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw new AppError('INTERNAL_ERROR', 'ClickPesa initiate failed.');
    }

    try {
      const row = await this.payments.createPendingMobileMoney(actorUserId, tenantId, {
        paymentId,
        invoiceId: parsed.invoiceId,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        providerCode: CLICKPESA_PROVIDER_CODE,
        providerRef: initiated.providerRef,
      });

      await this.safeAudit({
        action: 'payment.mobile_money.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_attempt',
        resourceId: row.id,
        metadata: { invoiceId: parsed.invoiceId, billPayNumber: initiated.providerRef },
      });

      return { data: { ...row, billPayNumber: initiated.providerRef } };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapPaymentWriteError(error);
    }
  }

  private async executeReverse(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    correlationId: string,
  ): Promise<ReversePaymentResult> {
    if (!this.payments.isAvailable()) {
      throw AppError.notFound('Payment not found.');
    }
    try {
      const row = await this.payments.reversePayment(actorUserId, tenantId, paymentId);

      await this.safeAudit({
        action: 'payment.reverse',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_attempt',
        resourceId: row.id,
        metadata: { invoiceId: row.invoiceId },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0002')) throw AppError.notFound('Payment not found.');
      if (isPgCode(error, '42501')) {
        throw AppError.forbidden('Active membership required for this tenant.');
      }
      if (isPgCode(error, '55000')) {
        throw new AppError(
          'CONFLICT',
          'Payment is not in succeeded status and cannot be reversed.',
        );
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to reverse payment.');
    }
  }

  private async executeReconcile(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    correlationId: string,
  ): Promise<ReconcilePaymentResult> {
    if (!this.payments.isAvailable()) {
      throw AppError.notFound('Payment not found.');
    }
    try {
      const row = await this.payments.reconcilePayment(
        actorUserId,
        tenantId,
        randomUUID(),
        paymentId,
      );

      await this.safeAudit({
        action: 'payment.reconcile',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_reconciliation',
        resourceId: row.id,
        metadata: { paymentAttemptId: paymentId, outcome: row.outcome },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0002')) throw AppError.notFound('Payment not found.');
      if (isPgCode(error, '42501')) {
        throw AppError.forbidden('Active membership required for this tenant.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to reconcile payment.');
    }
  }

  private async executeSyncProvider(
    actorUserId: string,
    tenantId: string,
    paymentId: string,
    correlationId: string,
  ): Promise<SyncProviderPaymentResult> {
    if (!this.payments.isAvailable()) {
      throw AppError.notFound('Payment not found.');
    }
    if (this.provider.providerCode !== CLICKPESA_PROVIDER_CODE) {
      throw new AppError(
        'NOT_IMPLEMENTED',
        'Provider sync requires PAYMENT_PROVIDER=clickpesa with secrets configured.',
      );
    }
    if (this.provider.queryStatus === undefined) {
      throw new AppError('NOT_IMPLEMENTED', 'Provider does not support queryStatus.');
    }

    const attempt = await this.payments.getPayment(actorUserId, tenantId, paymentId);
    if (attempt === null) throw AppError.notFound('Payment not found.');
    if (attempt.providerCode !== CLICKPESA_PROVIDER_CODE || attempt.method !== 'mobile_money') {
      throw AppError.validation('Payment is not a ClickPesa mobile_money attempt.', {
        field: 'paymentId',
      });
    }
    if (attempt.status !== 'pending') {
      return {
        data: {
          paymentAttemptId: paymentId,
          providerStatus: attempt.status,
          completed: false,
          detail: 'not_pending',
        },
      };
    }

    let queried;
    try {
      queried = await this.provider.queryStatus(paymentId);
    } catch {
      throw new AppError('INTERNAL_ERROR', 'ClickPesa query failed.');
    }

    if (queried.status === 'pending') {
      return {
        data: {
          paymentAttemptId: paymentId,
          providerStatus: 'pending',
          completed: false,
          detail: 'still_pending',
        },
      };
    }

    const providerEventId =
      queried.providerEventId ??
      `query:${paymentId}:${queried.status}:${String(queried.amountMinor ?? 'na')}`;

    if (queried.status === 'failed') {
      const ingested = await this.payments.ingestClickPesaGatewayEvent({
        gatewayEventId: randomUUID(),
        providerEventId,
        payloadSha256: hashRequestBody(
          JSON.stringify({ source: 'query', paymentId, status: 'failed' }),
        ),
        orderReference: paymentId,
        amountMinor: attempt.amountMinor,
        providerOutcome: 'failed',
        receiptId: randomUUID(),
      });
      await this.safeAudit({
        action: 'payment.sync_provider',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'payment_attempt',
        resourceId: paymentId,
        metadata: { detail: ingested.detail, providerStatus: 'failed' },
      });
      return {
        data: {
          paymentAttemptId: paymentId,
          providerStatus: 'failed',
          completed: false,
          detail: ingested.detail,
        },
      };
    }

    // succeeded
    if (queried.amountMinor === undefined) {
      return {
        data: {
          paymentAttemptId: paymentId,
          providerStatus: 'succeeded',
          completed: false,
          detail: 'missing_amount',
        },
      };
    }

    const ingested = await this.payments.ingestClickPesaGatewayEvent({
      gatewayEventId: randomUUID(),
      providerEventId,
      payloadSha256: hashRequestBody(
        JSON.stringify({
          source: 'query',
          paymentId,
          status: 'succeeded',
          amountMinor: queried.amountMinor,
        }),
      ),
      orderReference: paymentId,
      amountMinor: queried.amountMinor,
      providerOutcome: 'succeeded',
      receiptId: randomUUID(),
    });

    await this.safeAudit({
      action: 'payment.sync_provider',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'payment_attempt',
      resourceId: paymentId,
      metadata: {
        detail: ingested.detail,
        completed: ingested.completed,
        providerStatus: 'succeeded',
      },
    });

    return {
      data: {
        paymentAttemptId: paymentId,
        providerStatus: 'succeeded',
        completed: ingested.completed,
        detail: ingested.detail,
      },
    };
  }

  private async executeSyncPending(
    actorUserId: string,
    tenantId: string,
    limit: number,
    correlationId: string,
  ): Promise<SyncPendingClickPesaResult> {
    if (!this.payments.isAvailable()) {
      return { data: { scanned: 0, completed: 0, results: [] } };
    }
    if (this.provider.providerCode !== CLICKPESA_PROVIDER_CODE) {
      throw new AppError(
        'NOT_IMPLEMENTED',
        'Provider sync requires PAYMENT_PROVIDER=clickpesa with secrets configured.',
      );
    }

    const pending = await this.payments.listPendingClickPesa(actorUserId, tenantId, limit);
    const results: Array<SyncProviderPaymentResult['data']> = [];
    let completed = 0;
    for (const row of pending) {
      const one = await this.executeSyncProvider(actorUserId, tenantId, row.id, correlationId);
      results.push(one.data);
      if (one.data.completed) completed += 1;
    }

    await this.safeAudit({
      action: 'payment.sync_provider_pending',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'payment_attempt',
      resourceId: tenantId,
      metadata: { scanned: pending.length, completed },
    });

    return { data: { scanned: pending.length, completed, results } };
  }

  private async safeAudit(input: {
    readonly action: string;
    readonly outcome: 'success' | 'failure';
    readonly correlationId: string;
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    if (this.audit === null) return;
    try {
      await this.audit.publish(input);
    } catch {
      // audit must not break the product path
    }
  }
}

type ParsedCreatePayment = {
  readonly invoiceId: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
};

type ParsedCreateMobileMoney = {
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description?: string | undefined;
};

function parseCreatePaymentRequest(raw: unknown): ParsedCreatePayment {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['invoiceId', 'method', 'amountMinor', 'currency']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['invoiceId'] !== 'string' || !isUuid(body['invoiceId'])) {
    throw AppError.validation('invoiceId is required and must be a UUID.', { field: 'invoiceId' });
  }
  if (typeof body['method'] !== 'string' || !PAYMENT_METHODS.has(body['method'])) {
    throw AppError.validation(
      'method is required and must be one of cash, bank, cheque, other, mobile_money.',
      { field: 'method' },
    );
  }

  const amountMinor = requirePositiveIntegerMinor(body['amountMinor'], 'amountMinor');

  let currency = 'TZS';
  if (body['currency'] !== undefined) {
    if (typeof body['currency'] !== 'string' || body['currency'] !== 'TZS') {
      throw AppError.validation('currency must be TZS.', { field: 'currency' });
    }
    currency = body['currency'];
  }

  return { invoiceId: body['invoiceId'], method: body['method'], amountMinor, currency };
}

function parseCreateMobileMoneyRequest(raw: unknown): ParsedCreateMobileMoney {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['invoiceId', 'amountMinor', 'currency', 'description']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }
  if (typeof body['invoiceId'] !== 'string' || !isUuid(body['invoiceId'])) {
    throw AppError.validation('invoiceId is required and must be a UUID.', { field: 'invoiceId' });
  }
  const amountMinor = requirePositiveIntegerMinor(body['amountMinor'], 'amountMinor');
  if (amountMinor % 100 !== 0) {
    throw AppError.validation(
      'amountMinor must be divisible by 100 for mobile money (whole TZS).',
      {
        field: 'amountMinor',
      },
    );
  }
  let currency = 'TZS';
  if (body['currency'] !== undefined) {
    if (typeof body['currency'] !== 'string' || body['currency'] !== 'TZS') {
      throw AppError.validation('currency must be TZS.', { field: 'currency' });
    }
    currency = body['currency'];
  }
  let description: string | undefined;
  if (body['description'] !== undefined) {
    if (typeof body['description'] !== 'string' || body['description'].trim() === '') {
      throw AppError.validation('description must be a non-empty string when provided.', {
        field: 'description',
      });
    }
    description = body['description'].trim().slice(0, 200);
  }
  return {
    invoiceId: body['invoiceId'],
    amountMinor,
    currency,
    ...(description !== undefined ? { description } : {}),
  };
}

function parseClickPesaWebhookPayload(payload: Record<string, unknown>): {
  readonly providerEventId: string;
  readonly orderReference: string;
  readonly amountMinor: number;
  readonly outcome: 'succeeded' | 'failed';
} {
  const event = payload['event'];
  const dataRaw = payload['data'];
  if (dataRaw === null || typeof dataRaw !== 'object' || Array.isArray(dataRaw)) {
    throw AppError.validation('data object is required.');
  }
  const data = dataRaw as Record<string, unknown>;

  if (event === 'PAYMENT FAILED') {
    const id = typeof data['id'] === 'string' ? data['id'].trim() : '';
    const orderReference =
      typeof data['orderReference'] === 'string' ? data['orderReference'].trim() : '';
    if (id === '' || !isUuid(orderReference)) {
      throw AppError.validation('PAYMENT FAILED requires id and UUID orderReference.');
    }
    // Amount may be absent on failure — use 1 minor placeholder for schema; completion path unused.
    return {
      providerEventId: id,
      orderReference,
      amountMinor: 1,
      outcome: 'failed',
    };
  }

  if (event !== 'PAYMENT RECEIVED') {
    throw AppError.validation('Unsupported ClickPesa event for MVP webhook.', { field: 'event' });
  }

  const id = typeof data['id'] === 'string' ? data['id'].trim() : '';
  const orderReference =
    typeof data['orderReference'] === 'string' ? data['orderReference'].trim() : '';
  if (id === '' || !isUuid(orderReference)) {
    throw AppError.validation('PAYMENT RECEIVED requires id and UUID orderReference.');
  }
  if (data['collectedAmount'] === undefined) {
    throw AppError.validation('collectedAmount is required.', { field: 'collectedAmount' });
  }
  let amountMinor: number;
  try {
    amountMinor = clickPesaMajorToMinor(data['collectedAmount'] as string | number);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid collectedAmount.';
    throw AppError.validation(message, { field: 'collectedAmount' });
  }
  return {
    providerEventId: id,
    orderReference,
    amountMinor,
    outcome: 'succeeded',
  };
}

function stripForHash(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'checksum' || k === 'checksumMethod') continue;
    next[k] = v;
  }
  return next;
}

function parseSyncPendingLimit(raw: unknown): number {
  if (raw === null || raw === undefined) return 25;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'limit') throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }
  if (body['limit'] === undefined) return 25;
  if (typeof body['limit'] !== 'number' || !Number.isInteger(body['limit'])) {
    throw AppError.validation('limit must be an integer.', { field: 'limit' });
  }
  if (body['limit'] < 1 || body['limit'] > 100) {
    throw AppError.validation('limit must be between 1 and 100.', { field: 'limit' });
  }
  return body['limit'];
}

type ParsedFakeWebhook = {
  readonly eventId: string;
  readonly paymentAttemptId: string | null;
  readonly amountMinor: number;
  readonly outcome: 'succeeded' | 'failed';
};

function parseFakeWebhookRequest(raw: unknown): ParsedFakeWebhook {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['eventId', 'paymentAttemptId', 'amountMinor', 'outcome']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['eventId'] !== 'string' || body['eventId'].trim().length < 1) {
    throw AppError.validation('eventId is required.', { field: 'eventId' });
  }

  let paymentAttemptId: string | null = null;
  if (
    body['paymentAttemptId'] !== undefined &&
    body['paymentAttemptId'] !== null &&
    body['paymentAttemptId'] !== ''
  ) {
    if (typeof body['paymentAttemptId'] !== 'string' || !isUuid(body['paymentAttemptId'])) {
      throw AppError.validation('paymentAttemptId must be a UUID.', {
        field: 'paymentAttemptId',
      });
    }
    paymentAttemptId = body['paymentAttemptId'];
  }

  const amountMinor = requirePositiveIntegerMinor(body['amountMinor'], 'amountMinor');

  if (typeof body['outcome'] !== 'string' || !WEBHOOK_OUTCOMES.has(body['outcome'])) {
    throw AppError.validation('outcome must be succeeded or failed.', { field: 'outcome' });
  }

  return {
    eventId: body['eventId'].trim(),
    paymentAttemptId,
    amountMinor,
    outcome: body['outcome'] as 'succeeded' | 'failed',
  };
}

/** Minor-unit money is always an integer — floats are rejected outright (ACF-012). */
function requirePositiveIntegerMinor(raw: unknown, field: string): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw AppError.validation(`${field} is required and must be an integer.`, { field });
  }
  if (!Number.isInteger(raw)) {
    throw AppError.validation(`${field} must be an integer minor-unit amount (no decimals).`, {
      field,
    });
  }
  if (raw <= 0) {
    throw AppError.validation(`${field} must be greater than zero.`, { field });
  }
  return raw;
}

function mapPaymentWriteError(error: unknown): AppError {
  if (isPgCode(error, 'P0002')) {
    return AppError.notFound('Invoice not found.');
  }
  if (isPgCode(error, '55000')) {
    return new AppError('CONFLICT', 'Invoice is not payable in its current status.');
  }
  if (isPgCode(error, '42501')) {
    return AppError.forbidden('Active membership required for this tenant.');
  }
  if (isPgCode(error, '22023')) {
    const m = getMsg(error);
    if (m.includes('amount exceeds outstanding balance')) {
      return AppError.validation('amountMinor exceeds the invoice outstanding balance.', {
        field: 'amountMinor',
      });
    }
    return AppError.validation('Invalid payment payload.');
  }
  return new AppError('INTERNAL_ERROR', 'Failed to record payment.');
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

function getMsg(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'object' && error !== null) {
    const m = (error as Record<string, unknown>)['message'];
    if (typeof m === 'string') return m.toLowerCase();
  }
  return String(error).toLowerCase();
}
