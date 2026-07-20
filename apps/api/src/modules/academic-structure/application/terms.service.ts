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
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import { TermsRepository, type TermRow } from '../repositories/terms.repository.js';

/** Public term item (ACF-004 allowlist — list + detail + create). */
export type Term = TermRow;

export type ListTermsResult = PaginatedResponse<Term>;

export type GetTermResult = {
  readonly data: Term;
};

export type CreateTermResult = {
  readonly data: Term;
};

const TERM_STATUSES = new Set(['draft', 'active', 'closed']);
const CREATE_ROUTE = '/api/v1/terms';
const CODE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Product API for terms in the bound tenant.
 * GET list (P3) + detail (P4) + POST create (P5). Years/classes not here.
 */
@Injectable()
export class TermsService {
  constructor(
    private readonly terms: TermsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /terms/:id — detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    actorUserId: string,
    tenantId: string,
    termId: string,
  ): Promise<GetTermResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(termId)) {
      throw AppError.notFound('Term not found.');
    }

    if (!this.terms.isAvailable()) {
      throw AppError.notFound('Term not found.');
    }

    const term = await this.terms.getByIdForTenant(actorUserId, tenantId, termId);
    if (term === null) {
      throw AppError.notFound('Term not found.');
    }
    return { data: term };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, academicYearId, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   *
   * Cross-tenant / missing academicYearId UUID → empty page (no existence leak).
   * Non-UUID academicYearId → 400 VALIDATION_ERROR.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly academicYearId?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListTermsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const academicYearId = parseOptionalUuidFilter(rawQuery.academicYearId, 'academicYearId');
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.terms.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.terms.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      academicYearId,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * POST /terms — create (Idempotency-Key required).
   * tenantId always from bound context, never body.
   * Parent year missing/other-tenant → 400 VALIDATION_ERROR (no existence leak via 403).
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateTermResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateTermRequest(rawBody);
    const bodyJson = JSON.stringify({
      academicYearId: parsed.academicYearId,
      name: parsed.name,
      ...(parsed.code === undefined ? {} : { code: parsed.code }),
      ...(parsed.startsOn === null ? {} : { startsOn: parsed.startsOn }),
      ...(parsed.endsOn === null ? {} : { endsOn: parsed.endsOn }),
      status: parsed.status,
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route: CREATE_ROUTE,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as CreateTermResult;
      }

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

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: {
      academicYearId: string;
      name: string;
      code: string | undefined;
      startsOn: string | null;
      endsOn: string | null;
      status: string;
    },
    correlationId: string,
  ): Promise<CreateTermResult> {
    if (!this.terms.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Term store unavailable.');
    }

    try {
      const term = await this.terms.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        academicYearId: parsed.academicYearId,
        name: parsed.name,
        code: parsed.code,
        startsOn: parsed.startsOn,
        endsOn: parsed.endsOn,
        status: parsed.status,
      });
      if (term === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create term.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'term.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'term',
          resourceId: term.id,
          metadata: {
            status: parsed.status,
            hasCode: parsed.code !== undefined,
            academicYearId: parsed.academicYearId,
          },
        });
      }

      return { data: term };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Term code already exists for this academic year.');
      }
      if (isParentYearNotFound(error)) {
        throw AppError.validation('academicYearId not found in this tenant.', {
          field: 'academicYearId',
        });
      }
      if (isPgInvalidParameter(error) || isPgCheckViolation(error)) {
        throw AppError.validation('Invalid term payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create term.');
    }
  }
}

function parseStatusFilter(raw: unknown): 'draft' | 'active' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !TERM_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}

/**
 * Optional UUID query param. Empty/absent → undefined.
 * Present but not UUID → VALIDATION_ERROR (strict filters; not silent empty).
 */
function parseOptionalUuidFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

export function parseCreateTermRequest(raw: unknown): {
  academicYearId: string;
  name: string;
  code: string | undefined;
  startsOn: string | null;
  endsOn: string | null;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['academicYearId', 'name', 'code', 'startsOn', 'endsOn', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  if (typeof body['academicYearId'] !== 'string' || !isUuid(body['academicYearId'])) {
    throw AppError.validation('academicYearId is required and must be a UUID.', {
      field: 'academicYearId',
    });
  }
  const academicYearId = body['academicYearId'];

  if (typeof body['name'] !== 'string') {
    throw AppError.validation('name is required.', { field: 'name' });
  }
  const name = body['name'].trim();
  if (name.length < 1 || name.length > 200) {
    throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
  }

  let code: string | undefined;
  if (body['code'] !== undefined && body['code'] !== null) {
    if (typeof body['code'] !== 'string') {
      throw AppError.validation('code must be a string.', { field: 'code' });
    }
    const trimmed = body['code'].trim();
    if (trimmed.length === 0) {
      code = undefined;
    } else if (!CODE_PATTERN.test(trimmed)) {
      throw AppError.validation('code has invalid format.', { field: 'code' });
    } else {
      code = trimmed;
    }
  }

  const startsOn = parseOptionalDate(body['startsOn'], 'startsOn');
  const endsOn = parseOptionalDate(body['endsOn'], 'endsOn');
  if (startsOn !== null && endsOn !== null && endsOn < startsOn) {
    throw AppError.validation('endsOn must be on or after startsOn.', { field: 'endsOn' });
  }

  let status = 'draft';
  if (body['status'] !== undefined && body['status'] !== null) {
    if (typeof body['status'] !== 'string' || !TERM_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', {
        field: 'status',
      });
    }
    status = body['status'];
  }

  return { academicYearId, name, code, startsOn, endsOn, status };
}

function parseOptionalDate(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw !== 'string' || !ISO_DATE.test(raw)) {
    throw AppError.validation(`${field} must be an ISO date YYYY-MM-DD.`, { field });
  }
  const [ys, ms, ds] = raw.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw AppError.validation(`${field} is not a valid calendar date.`, { field });
  }
  return raw;
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

function isPgInvalidParameter(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '22023'
  );
}

function isPgCheckViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23514'
  );
}

function isParentYearNotFound(error: unknown): boolean {
  if (!isPgInvalidParameter(error)) {
    return false;
  }
  return getErrorMessage(error).toLowerCase().includes('parent academic year not found');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record['message'];
    if (typeof message === 'string') {
      return message;
    }
  }
  return String(error);
}
