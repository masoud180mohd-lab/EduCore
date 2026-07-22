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
import { FAKE_PROVIDER_CODE } from '../providers/fake-payment.provider.js';
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

const PAYMENT_METHODS = new Set(['cash', 'bank', 'cheque', 'other', 'mobile_money']);
const PAYMENTS_ROUTE = '/api/v1/payments';
const REVERSE_SUFFIX = '/reverse';
const WEBHOOK_OUTCOMES = new Set(['succeeded', 'failed']);

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentAttemptsRepository,
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
   * Wave G / DBF-012 rev 1.2. Minimal Fake webhook stub: dedupes on
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
