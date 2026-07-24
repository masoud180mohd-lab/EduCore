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
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import {
  AcademicYearsRepository,
  type AcademicYearRow,
} from '../repositories/academic-years.repository.js';

/** Public academic year item (ACF-003 allowlist — list + detail + create). */
export type AcademicYear = AcademicYearRow;

export type ListAcademicYearsResult = PaginatedResponse<AcademicYear>;

export type GetAcademicYearResult = {
  readonly data: AcademicYear;
};

export type CreateAcademicYearResult = {
  readonly data: AcademicYear;
};

export type PatchAcademicYearResult = {
  readonly data: AcademicYear;
};

export type DeleteAcademicYearResult = void;

const ACADEMIC_YEAR_STATUSES = new Set(['draft', 'active', 'closed']);
const CREATE_ROUTE = '/api/v1/academic-years';
const PATCH_ROUTE_PREFIX = '/api/v1/academic-years/';
const CODE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Product API for academic years in the bound tenant.
 * GET list (P0) + detail (P1) + POST create (P2) + PATCH (IMP-013). Terms/classes deferred.
 */
@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly academicYears: AcademicYearsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /academic-years/:id — detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    actorUserId: string,
    tenantId: string,
    academicYearId: string,
  ): Promise<GetAcademicYearResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(academicYearId)) {
      throw AppError.notFound('Academic year not found.');
    }

    if (!this.academicYears.isAvailable()) {
      throw AppError.notFound('Academic year not found.');
    }

    const year = await this.academicYears.getByIdForTenant(actorUserId, tenantId, academicYearId);
    if (year === null) {
      throw AppError.notFound('Academic year not found.');
    }
    return { data: year };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListAcademicYearsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.academicYears.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.academicYears.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * POST /academic-years — create (Idempotency-Key required).
   * tenantId always from bound context, never body.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateAcademicYearResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateAcademicYearRequest(rawBody);
    const bodyJson = JSON.stringify({
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
        return JSON.parse(replay.responseBody) as CreateAcademicYearResult;
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
      name: string;
      code: string | undefined;
      startsOn: string | null;
      endsOn: string | null;
      status: string;
    },
    correlationId: string,
  ): Promise<CreateAcademicYearResult> {
    if (!this.academicYears.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Academic year store unavailable.');
    }

    try {
      const year = await this.academicYears.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        name: parsed.name,
        code: parsed.code,
        startsOn: parsed.startsOn,
        endsOn: parsed.endsOn,
        status: parsed.status,
      });
      if (year === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create academic year.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'academic_year.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'academic_year',
          resourceId: year.id,
          metadata: {
            status: parsed.status,
            hasCode: parsed.code !== undefined,
          },
        });
      }

      return { data: year };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Academic year code already exists in this tenant.');
      }
      if (isPgInvalidParameter(error) || isPgCheckViolation(error)) {
        throw AppError.validation('Invalid academic year payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create academic year.');
    }
  }

  /**
   * PATCH /academic-years/:id — partial update (academic.manage).
   * Idempotency-Key optional. Missing/cross-tenant → 404.
   */
  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    academicYearId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchAcademicYearResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(academicYearId)) {
      throw AppError.notFound('Academic year not found.');
    }

    const parsed = parsePatchAcademicYearRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setName ? { name: parsed.name } : {}),
      ...(parsed.setCode ? { code: parsed.code } : {}),
      ...(parsed.setStartsOn ? { startsOn: parsed.startsOn } : {}),
      ...(parsed.setEndsOn ? { endsOn: parsed.endsOn } : {}),
      ...(parsed.setStatus ? { status: parsed.status } : {}),
    });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'PATCH',
          route: `${PATCH_ROUTE_PREFIX}${academicYearId}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as PatchAcademicYearResult;
      }

      const result = await this.executePatch(
        actorUserId,
        tenantId,
        academicYearId,
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

    return this.executePatch(actorUserId, tenantId, academicYearId, parsed, correlationId);
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    academicYearId: string,
    parsed: ParsedAcademicYearPatch,
    correlationId: string,
  ): Promise<PatchAcademicYearResult> {
    if (!this.academicYears.isAvailable()) {
      throw AppError.notFound('Academic year not found.');
    }

    try {
      const year = await this.academicYears.updateForTenant(actorUserId, tenantId, academicYearId, {
        setName: parsed.setName,
        name: parsed.name,
        setCode: parsed.setCode,
        code: parsed.code,
        setStartsOn: parsed.setStartsOn,
        startsOn: parsed.startsOn,
        setEndsOn: parsed.setEndsOn,
        endsOn: parsed.endsOn,
        setStatus: parsed.setStatus,
        status: parsed.status,
      });
      if (year === null) {
        throw AppError.notFound('Academic year not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'academic_year.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'academic_year',
          resourceId: year.id,
          metadata: { fields: parsed.fields },
        });
      }

      return { data: year };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Academic year code already exists in this tenant.');
      }
      if (isPgInvalidParameter(error) || isPgCheckViolation(error)) {
        throw AppError.validation('Invalid academic year payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update academic year.');
    }
  }

  /**
   * DELETE /academic-years/:id — delete when empty (academic.manage) (IMP-014).
   * Missing/cross-tenant/invalid id → 404. Dependents present → 409 CONFLICT.
   */
  async deleteForTenant(
    actorUserId: string,
    tenantId: string,
    academicYearId: string,
    correlationId: string,
  ): Promise<void> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(academicYearId)) {
      throw AppError.notFound('Academic year not found.');
    }
    if (!this.academicYears.isAvailable()) {
      throw AppError.notFound('Academic year not found.');
    }

    try {
      const deleted = await this.academicYears.deleteForTenant(
        actorUserId,
        tenantId,
        academicYearId,
      );
      if (deleted === null || deleted === false) {
        throw AppError.notFound('Academic year not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'academic_year.delete',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'academic_year',
          resourceId: academicYearId,
          metadata: {},
        });
      }
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgHasDependents(error)) {
        throw new AppError('CONFLICT', 'Cannot delete academic year with dependents.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to delete academic year.');
    }
  }
}

type ParsedAcademicYearPatch = {
  setName: boolean;
  name: string | null;
  setCode: boolean;
  code: string | null;
  setStartsOn: boolean;
  startsOn: string | null;
  setEndsOn: boolean;
  endsOn: string | null;
  setStatus: boolean;
  status: string | null;
  fields: string[];
};

function parseStatusFilter(raw: unknown): 'draft' | 'active' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !ACADEMIC_YEAR_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}

export function parseCreateAcademicYearRequest(raw: unknown): {
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
  const allowed = new Set(['name', 'code', 'startsOn', 'endsOn', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

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
    if (typeof body['status'] !== 'string' || !ACADEMIC_YEAR_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', {
        field: 'status',
      });
    }
    status = body['status'];
  }

  return { name, code, startsOn, endsOn, status };
}

export function parsePatchAcademicYearRequest(raw: unknown): ParsedAcademicYearPatch {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'code', 'startsOn', 'endsOn', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  const fields: string[] = [];
  let setName = false;
  let name: string | null = null;
  let setCode = false;
  let code: string | null = null;
  let setStartsOn = false;
  let startsOn: string | null = null;
  let setEndsOn = false;
  let endsOn: string | null = null;
  let setStatus = false;
  let status: string | null = null;

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof body['name'] !== 'string') {
      throw AppError.validation('name must be a string.', { field: 'name' });
    }
    const trimmed = body['name'].trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
      throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
    }
    setName = true;
    name = trimmed;
    fields.push('name');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'code')) {
    setCode = true;
    fields.push('code');
    if (body['code'] === null) {
      code = null;
    } else if (typeof body['code'] !== 'string') {
      throw AppError.validation('code must be a string or null.', { field: 'code' });
    } else {
      const trimmed = body['code'].trim();
      if (trimmed === '') {
        code = null;
      } else if (!CODE_PATTERN.test(trimmed)) {
        throw AppError.validation('code has invalid format.', { field: 'code' });
      } else {
        code = trimmed;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'startsOn')) {
    setStartsOn = true;
    fields.push('startsOn');
    startsOn = parseOptionalDate(body['startsOn'], 'startsOn');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'endsOn')) {
    setEndsOn = true;
    fields.push('endsOn');
    endsOn = parseOptionalDate(body['endsOn'], 'endsOn');
  }

  if (setStartsOn && setEndsOn && startsOn !== null && endsOn !== null && endsOn < startsOn) {
    throw AppError.validation('endsOn must be on or after startsOn.', { field: 'endsOn' });
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body['status'] !== 'string' || !ACADEMIC_YEAR_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', {
        field: 'status',
      });
    }
    setStatus = true;
    status = body['status'];
    fields.push('status');
  }

  if (fields.length === 0) {
    throw AppError.validation('At least one field is required for patch.');
  }

  return {
    setName,
    name,
    setCode,
    code,
    setStartsOn,
    startsOn,
    setEndsOn,
    endsOn,
    setStatus,
    status,
    fields,
  };
}

function parseOptionalDate(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw !== 'string' || !ISO_DATE.test(raw)) {
    throw AppError.validation(`${field} must be an ISO date YYYY-MM-DD.`, { field });
  }
  // Calendar validity
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

/** True for the P0001 'has dependents' raised by app.delete_* helpers (IMP-014). */
function isPgHasDependents(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P0001' &&
    'message' in error &&
    String((error as { message: unknown }).message).includes('has dependents')
  );
}
