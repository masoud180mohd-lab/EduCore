/**
 * Fee structures application service (IMP-009 / ACF-012).
 * Money is always integer minor units — floats are rejected, never rounded.
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  IDEMPOTENCY_STORE,
  parseIdempotencyKey,
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
  type FeeStructureItemRow,
  type FeeStructureRow,
} from '../repositories/finance.repository.js';

export type FeeStructure = FeeStructureRow;
export type FeeStructureItem = FeeStructureItemRow;

export type ListFeeStructuresResult = PaginatedResponse<FeeStructure>;
export type GetFeeStructureResult = {
  readonly data: FeeStructure & { readonly items: ReadonlyArray<FeeStructureItem> };
};
export type CreateFeeStructureResult = { readonly data: FeeStructure };
export type PatchFeeStructureResult = GetFeeStructureResult;

const FEE_STRUCTURE_STATUSES = new Set(['draft', 'active', 'archived']);
const NAME_MAX_LEN = 200;
const FEE_STRUCTURES_ROUTE = '/api/v1/fee-structures';
const FEE_STRUCTURES_PATCH_ROUTE_PREFIX = '/api/v1/fee-structures/';

@Injectable()
export class FeeStructuresService {
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
      readonly academicYearId?: unknown;
      readonly status?: unknown;
    },
  ): Promise<ListFeeStructuresResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const pagination = parsePaginationQuery(rawQuery);
    const academicYearId = parseOptionalUuid(rawQuery.academicYearId, 'academicYearId');
    const status = parseStatusFilter(rawQuery.status);

    if (!this.finance.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.finance.listFeeStructures(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      academicYearId,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
  ): Promise<GetFeeStructureResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(feeStructureId)) throw AppError.notFound('Fee structure not found.');
    if (!this.finance.isAvailable()) throw AppError.notFound('Fee structure not found.');

    const structure = await this.finance.getFeeStructure(actorUserId, tenantId, feeStructureId);
    if (structure === null) throw AppError.notFound('Fee structure not found.');

    const items = await this.finance.listFeeStructureItems(actorUserId, tenantId, feeStructureId);
    return { data: { ...structure, items } };
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateFeeStructureResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateFeeStructureRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: FEE_STRUCTURES_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateFeeStructureResult;

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

  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchFeeStructureResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(feeStructureId)) {
      throw AppError.validation('feeStructureId must be a UUID.', { field: 'feeStructureId' });
    }

    const parsed = parsePatchFeeStructureRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setName ? { name: parsed.name } : {}),
      ...(parsed.setStatus ? { status: parsed.status } : {}),
      ...(parsed.setItems ? { items: parsed.items } : {}),
    });
    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);

    if (optionalKey !== undefined) {
      const key = assertIdempotencyKey(optionalKey);
      if (this.idempotency !== null) {
        const scopeKey = buildIdempotencyScopeKey(
          {
            actorUserId,
            tenantId,
            method: 'PATCH',
            route: `${FEE_STRUCTURES_PATCH_ROUTE_PREFIX}${feeStructureId}`,
          },
          key,
        );
        const bodyHash = hashRequestBody(bodyJson);
        const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
        if (replay !== null) {
          return JSON.parse(replay.responseBody) as PatchFeeStructureResult;
        }

        const result = await this.executePatch(
          actorUserId,
          tenantId,
          feeStructureId,
          parsed,
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
    }

    return this.executePatch(actorUserId, tenantId, feeStructureId, parsed, correlationId);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: ParsedCreateFeeStructure,
    correlationId: string,
  ): Promise<CreateFeeStructureResult> {
    if (!this.finance.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Finance store unavailable.');
    }
    try {
      const row = await this.finance.createFeeStructure(actorUserId, tenantId, {
        id: randomUUID(),
        academicYearId: parsed.academicYearId,
        name: parsed.name,
        status: parsed.status,
        currency: parsed.currency,
        items: parsed.items.map((item) => ({ id: randomUUID(), ...item })),
      });

      await this.safeAudit({
        action: 'fee_structure.create',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'fee_structure',
        resourceId: row.id,
        metadata: { academicYearId: parsed.academicYearId, itemCount: parsed.items.length },
      });
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapFeeStructureWriteError(error);
    }
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    feeStructureId: string,
    parsed: ParsedPatchFeeStructure,
    correlationId: string,
  ): Promise<PatchFeeStructureResult> {
    if (!this.finance.isAvailable()) throw AppError.notFound('Fee structure not found.');

    try {
      const row = await this.finance.updateFeeStructure(actorUserId, tenantId, feeStructureId, {
        setName: parsed.setName,
        name: parsed.name,
        setStatus: parsed.setStatus,
        status: parsed.status,
        setItems: parsed.setItems,
        items:
          parsed.items === null
            ? null
            : parsed.items.map((item) => ({ id: randomUUID(), ...item })),
      });
      if (row === null) throw AppError.notFound('Fee structure not found.');

      const items = await this.finance.listFeeStructureItems(actorUserId, tenantId, feeStructureId);
      await this.safeAudit({
        action: 'fee_structure.patch',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'fee_structure',
        resourceId: row.id,
        metadata: { fields: parsed.fields },
      });
      return { data: { ...row, items } };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw mapFeeStructureWriteError(error, 'update');
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

type ParsedFeeStructureItem = {
  readonly name: string;
  readonly amountMinor: number;
  readonly sortOrder: number;
};

type ParsedCreateFeeStructure = {
  readonly academicYearId: string;
  readonly name: string;
  readonly status: string;
  readonly currency: string;
  readonly items: ReadonlyArray<ParsedFeeStructureItem>;
};

type ParsedPatchFeeStructure = {
  readonly setName: boolean;
  readonly name: string | null;
  readonly setStatus: boolean;
  readonly status: string | null;
  readonly setItems: boolean;
  readonly items: ReadonlyArray<ParsedFeeStructureItem> | null;
  readonly fields: ReadonlyArray<string>;
};

function parseCreateFeeStructureRequest(raw: unknown): ParsedCreateFeeStructure {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['academicYearId', 'name', 'status', 'currency', 'items']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['academicYearId'] !== 'string' || !isUuid(body['academicYearId'])) {
    throw AppError.validation('academicYearId is required and must be a UUID.', {
      field: 'academicYearId',
    });
  }
  if (typeof body['name'] !== 'string') {
    throw AppError.validation('name is required.', { field: 'name' });
  }
  const name = body['name'].trim();
  if (name.length < 1 || name.length > NAME_MAX_LEN) {
    throw AppError.validation(`name must be 1–${String(NAME_MAX_LEN)} characters.`, {
      field: 'name',
    });
  }

  let status = 'draft';
  if (body['status'] !== undefined) {
    if (typeof body['status'] !== 'string' || !FEE_STRUCTURE_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or archived.', { field: 'status' });
    }
    status = body['status'];
  }

  let currency = 'TZS';
  if (body['currency'] !== undefined) {
    if (typeof body['currency'] !== 'string' || body['currency'] !== 'TZS') {
      throw AppError.validation('currency must be TZS.', { field: 'currency' });
    }
    currency = body['currency'];
  }

  if (!Array.isArray(body['items']) || body['items'].length === 0) {
    throw AppError.validation('items is required and must be a non-empty array.', {
      field: 'items',
    });
  }
  const items = body['items'].map((item, index) => parseFeeStructureItem(item, index));

  return { academicYearId: body['academicYearId'], name, status, currency, items };
}

function parsePatchFeeStructureRequest(raw: unknown): ParsedPatchFeeStructure {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'status', 'items']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  const setName = Object.prototype.hasOwnProperty.call(body, 'name');
  const setStatus = Object.prototype.hasOwnProperty.call(body, 'status');
  const setItems = Object.prototype.hasOwnProperty.call(body, 'items');
  if (!setName && !setStatus && !setItems) {
    throw AppError.validation('At least one of name, status, or items is required.');
  }

  let name: string | null = null;
  if (setName) {
    if (typeof body['name'] !== 'string') {
      throw AppError.validation('name must be a string.', { field: 'name' });
    }
    name = body['name'].trim();
    if (name.length < 1 || name.length > NAME_MAX_LEN) {
      throw AppError.validation(`name must be 1–${String(NAME_MAX_LEN)} characters.`, {
        field: 'name',
      });
    }
  }

  let status: string | null = null;
  if (setStatus) {
    if (typeof body['status'] !== 'string' || !FEE_STRUCTURE_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or archived.', { field: 'status' });
    }
    status = body['status'];
  }

  let items: ReadonlyArray<ParsedFeeStructureItem> | null = null;
  if (setItems) {
    if (!Array.isArray(body['items']) || body['items'].length === 0) {
      throw AppError.validation('items must be a non-empty array.', { field: 'items' });
    }
    items = body['items'].map((item, index) => parseFeeStructureItem(item, index));
  }

  return {
    setName,
    name,
    setStatus,
    status,
    setItems,
    items,
    fields: [
      ...(setName ? ['name'] : []),
      ...(setStatus ? ['status'] : []),
      ...(setItems ? ['items'] : []),
    ],
  };
}

function parseFeeStructureItem(raw: unknown, index: number): ParsedFeeStructureItem {
  const prefix = `items[${String(index)}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation(`${prefix} must be an object.`, { field: 'items' });
  }
  const item = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'amountMinor', 'sortOrder']);
  for (const key of Object.keys(item)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof item['name'] !== 'string') {
    throw AppError.validation(`${prefix}.name is required.`, { field: 'name' });
  }
  const name = item['name'].trim();
  if (name.length < 1 || name.length > NAME_MAX_LEN) {
    throw AppError.validation(`${prefix}.name must be 1–${String(NAME_MAX_LEN)} characters.`, {
      field: 'name',
    });
  }

  const amountMinor = requirePositiveIntegerMinor(item['amountMinor'], `${prefix}.amountMinor`);

  let sortOrder = index;
  if (item['sortOrder'] !== undefined) {
    if (typeof item['sortOrder'] !== 'number' || !Number.isInteger(item['sortOrder'])) {
      throw AppError.validation(`${prefix}.sortOrder must be an integer.`, { field: 'sortOrder' });
    }
    sortOrder = item['sortOrder'];
  }

  return { name, amountMinor, sortOrder };
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
  if (typeof raw !== 'string' || !FEE_STRUCTURE_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or archived.', { field: 'status' });
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

function mapFeeStructureWriteError(
  error: unknown,
  operation: 'create' | 'update' = 'create',
): AppError {
  const message = getMsg(error);
  if (
    isPgCode(error, '23503') ||
    (isPgCode(error, 'P0001') && (message.includes('in use') || message.includes('invoice')))
  ) {
    return new AppError('CONFLICT', 'Fee structure items are in use by invoices.');
  }
  if (isPgCode(error, '23505')) {
    return new AppError('CONFLICT', 'A conflicting fee structure already exists.');
  }
  if (isPgCode(error, '22023')) {
    if (message.includes('academic year not found')) {
      return AppError.validation('academicYearId not found in this tenant.', {
        field: 'academicYearId',
      });
    }
    return AppError.validation('Invalid fee structure payload.');
  }
  return new AppError(
    'INTERNAL_ERROR',
    operation === 'create' ? 'Failed to create fee structure.' : 'Failed to update fee structure.',
  );
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
