/**
 * Invoices application service (IMP-009 / ACF-012).
 * Revenue recognized on issue (DBF-012); balanceMinor is always derived, never stored.
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
import {
  FinanceRepository,
  type InvoiceLineRow,
  type InvoiceRow,
} from '../repositories/finance.repository.js';

export type Invoice = InvoiceRow;
export type InvoiceLine = InvoiceLineRow;

export type ListInvoicesResult = PaginatedResponse<Invoice>;
export type GetInvoiceResult = {
  readonly data: Invoice & { readonly lines: ReadonlyArray<InvoiceLine> };
};
export type CreateInvoiceResult = { readonly data: Invoice };
export type IssueInvoiceResult = { readonly data: Invoice };
export type VoidInvoiceResult = { readonly data: Invoice };

const INVOICE_STATUSES = new Set(['draft', 'issued', 'partially_paid', 'paid', 'void']);
const DESCRIPTION_MAX_LEN = 200;
const INVOICES_ROUTE = '/api/v1/invoices';
const ISSUE_SUFFIX = '/issue';
const VOID_SUFFIX = '/void';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly finance: FinanceRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly studentId?: unknown;
      readonly academicYearId?: unknown;
      readonly status?: unknown;
    },
  ): Promise<ListInvoicesResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const pagination = parsePaginationQuery(rawQuery);
    const studentId = parseOptionalUuid(rawQuery.studentId, 'studentId');
    const academicYearId = parseOptionalUuid(rawQuery.academicYearId, 'academicYearId');
    const status = parseStatusFilter(rawQuery.status);

    if (!this.finance.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.finance.listInvoices(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      studentId,
      academicYearId,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async summarizeForTenant(
    actorUserId: string,
    tenantId: string,
  ): Promise<{
    readonly data: {
      readonly collectedMinor: number;
      readonly outstandingMinor: number;
      readonly overdueCount: number;
      readonly issuedCount: number;
      readonly paidCount: number;
      readonly partiallyPaidCount: number;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.finance.isAvailable()) {
      return {
        data: {
          collectedMinor: 0,
          outstandingMinor: 0,
          overdueCount: 0,
          issuedCount: 0,
          paidCount: 0,
          partiallyPaidCount: 0,
        },
      };
    }
    const data = await this.finance.summarizeInvoices(actorUserId, tenantId);
    return { data };
  }

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<GetInvoiceResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(invoiceId)) throw AppError.notFound('Invoice not found.');
    if (!this.finance.isAvailable()) throw AppError.notFound('Invoice not found.');

    const found = await this.finance.getInvoiceWithLines(actorUserId, tenantId, invoiceId);
    if (found === null) throw AppError.notFound('Invoice not found.');
    return { data: { ...found.invoice, lines: found.lines } };
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateInvoiceResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateInvoiceRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: INVOICES_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateInvoiceResult;

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

  async issueForTenant(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<IssueInvoiceResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(invoiceId)) throw AppError.notFound('Invoice not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const route = `${INVOICES_ROUTE}/${invoiceId}${ISSUE_SUFFIX}`;
    const bodyJson = '{}';

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as IssueInvoiceResult;

      const result = await this.executeIssue(actorUserId, tenantId, invoiceId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeIssue(actorUserId, tenantId, invoiceId, correlationId);
  }

  /**
   * Wave D / DBF-012 rev 1.1. Void is allowed only for `issued` invoices with
   * zero active payment_allocations (blocked for partially_paid/paid); the
   * SECURITY DEFINER helper posts a reversing journal for the issue entry.
   */
  async voidForTenant(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<VoidInvoiceResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(invoiceId)) throw AppError.notFound('Invoice not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const route = `${INVOICES_ROUTE}/${invoiceId}${VOID_SUFFIX}`;
    const bodyJson = '{}';

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as VoidInvoiceResult;

      const result = await this.executeVoid(actorUserId, tenantId, invoiceId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeVoid(actorUserId, tenantId, invoiceId, correlationId);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: ParsedCreateInvoice,
    correlationId: string,
  ): Promise<CreateInvoiceResult> {
    if (!this.finance.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Finance store unavailable.');
    }
    try {
      const row = await this.finance.createInvoiceDraft(actorUserId, tenantId, {
        id: randomUUID(),
        studentId: parsed.studentId,
        academicYearId: parsed.academicYearId,
        feeStructureId: parsed.feeStructureId,
        lines: parsed.lines.map((line) => ({ id: randomUUID(), ...line })),
      });

      await this.safeAudit({
        action: 'invoice.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'invoice',
        resourceId: row.id,
        metadata: { studentId: parsed.studentId, lineCount: parsed.lines.length },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapInvoiceWriteError(error);
    }
  }

  private async executeIssue(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
    correlationId: string,
  ): Promise<IssueInvoiceResult> {
    if (!this.finance.isAvailable()) {
      throw AppError.notFound('Invoice not found.');
    }
    try {
      const row = await this.finance.issueInvoice(actorUserId, tenantId, invoiceId);

      await this.safeAudit({
        action: 'invoice.issue',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'invoice',
        resourceId: row.id,
        metadata: { totalMinor: row.totalMinor },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0002')) throw AppError.notFound('Invoice not found.');
      if (isPgCode(error, '55000')) {
        throw new AppError('CONFLICT', 'Invoice is not in draft status.');
      }
      if (isPgCode(error, '22023')) {
        throw AppError.validation('Invoice has no lines to issue.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to issue invoice.');
    }
  }

  private async executeVoid(
    actorUserId: string,
    tenantId: string,
    invoiceId: string,
    correlationId: string,
  ): Promise<VoidInvoiceResult> {
    if (!this.finance.isAvailable()) {
      throw AppError.notFound('Invoice not found.');
    }
    try {
      const row = await this.finance.voidInvoice(actorUserId, tenantId, invoiceId);

      await this.safeAudit({
        action: 'invoice.void',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'invoice',
        resourceId: row.id,
        metadata: { totalMinor: row.totalMinor },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0002')) throw AppError.notFound('Invoice not found.');
      if (isPgCode(error, '42501')) {
        throw AppError.forbidden('Active membership required for this tenant.');
      }
      if (isPgCode(error, '55000')) {
        const m = getMsg(error);
        if (m.includes('active payments')) {
          throw new AppError('CONFLICT', 'Invoice has active payments and cannot be voided.');
        }
        throw new AppError('CONFLICT', 'Invoice is not in issued status.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to void invoice.');
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

type ParsedInvoiceLine = {
  readonly description: string;
  readonly amountMinor: number;
  readonly feeStructureItemId: string | null;
};

type ParsedCreateInvoice = {
  readonly studentId: string;
  readonly academicYearId: string;
  readonly feeStructureId: string | null;
  readonly lines: ReadonlyArray<ParsedInvoiceLine>;
};

function parseCreateInvoiceRequest(raw: unknown): ParsedCreateInvoice {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['studentId', 'academicYearId', 'feeStructureId', 'lines']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['studentId'] !== 'string' || !isUuid(body['studentId'])) {
    throw AppError.validation('studentId is required and must be a UUID.', { field: 'studentId' });
  }
  if (typeof body['academicYearId'] !== 'string' || !isUuid(body['academicYearId'])) {
    throw AppError.validation('academicYearId is required and must be a UUID.', {
      field: 'academicYearId',
    });
  }

  let feeStructureId: string | null = null;
  if (
    body['feeStructureId'] !== undefined &&
    body['feeStructureId'] !== null &&
    body['feeStructureId'] !== ''
  ) {
    if (typeof body['feeStructureId'] !== 'string' || !isUuid(body['feeStructureId'])) {
      throw AppError.validation('feeStructureId must be a UUID.', { field: 'feeStructureId' });
    }
    feeStructureId = body['feeStructureId'];
  }

  if (!Array.isArray(body['lines']) || body['lines'].length === 0) {
    throw AppError.validation('lines is required and must be a non-empty array.', {
      field: 'lines',
    });
  }
  const lines = body['lines'].map((line, index) => parseInvoiceLine(line, index));

  return {
    studentId: body['studentId'],
    academicYearId: body['academicYearId'],
    feeStructureId,
    lines,
  };
}

function parseInvoiceLine(raw: unknown, index: number): ParsedInvoiceLine {
  const prefix = `lines[${String(index)}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation(`${prefix} must be an object.`, { field: 'lines' });
  }
  const line = raw as Record<string, unknown>;
  const allowed = new Set(['description', 'amountMinor', 'feeStructureItemId']);
  for (const key of Object.keys(line)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof line['description'] !== 'string') {
    throw AppError.validation(`${prefix}.description is required.`, { field: 'description' });
  }
  const description = line['description'].trim();
  if (description.length < 1 || description.length > DESCRIPTION_MAX_LEN) {
    throw AppError.validation(
      `${prefix}.description must be 1–${String(DESCRIPTION_MAX_LEN)} characters.`,
      { field: 'description' },
    );
  }

  const amountMinor = requirePositiveIntegerMinor(line['amountMinor'], `${prefix}.amountMinor`);

  let feeStructureItemId: string | null = null;
  if (
    line['feeStructureItemId'] !== undefined &&
    line['feeStructureItemId'] !== null &&
    line['feeStructureItemId'] !== ''
  ) {
    if (typeof line['feeStructureItemId'] !== 'string' || !isUuid(line['feeStructureItemId'])) {
      throw AppError.validation(`${prefix}.feeStructureItemId must be a UUID.`, {
        field: 'feeStructureItemId',
      });
    }
    feeStructureItemId = line['feeStructureItemId'];
  }

  return { description, amountMinor, feeStructureItemId };
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

function parseStatusFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !INVOICE_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, issued, partially_paid, paid, or void.', {
      field: 'status',
    });
  }
  return raw;
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function mapInvoiceWriteError(error: unknown): AppError {
  if (isPgCode(error, '23505')) {
    return new AppError('CONFLICT', 'A conflicting invoice already exists.');
  }
  if (isPgCode(error, '22023')) {
    const m = getMsg(error);
    if (m.includes('student not found')) {
      return AppError.validation('studentId not found in this tenant.', { field: 'studentId' });
    }
    if (m.includes('academic year not found')) {
      return AppError.validation('academicYearId not found in this tenant.', {
        field: 'academicYearId',
      });
    }
    if (m.includes('fee structure not found')) {
      return AppError.validation('feeStructureId not found in this tenant.', {
        field: 'feeStructureId',
      });
    }
    if (m.includes('fee structure item not found')) {
      return AppError.validation('lines[].feeStructureItemId not found in this tenant.', {
        field: 'feeStructureItemId',
      });
    }
    return AppError.validation('Invalid invoice payload.');
  }
  return new AppError('INTERNAL_ERROR', 'Failed to create invoice.');
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
