import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { mapAcademicDeleteDependentsConflict } from './academic-delete-conflict.js';
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
import { ClassesRepository, type ClassRow } from '../repositories/classes.repository.js';

/** Public class item (ACF-005 allowlist — list + detail + create). */
export type SchoolClass = ClassRow;

export type ListClassesResult = PaginatedResponse<SchoolClass>;

export type GetClassResult = {
  readonly data: SchoolClass;
};

export type CreateClassResult = {
  readonly data: SchoolClass;
};

export type PatchClassResult = {
  readonly data: SchoolClass;
};

const CLASS_STATUSES = new Set(['draft', 'active', 'closed']);
const CREATE_ROUTE = '/api/v1/classes';
const PATCH_ROUTE_PREFIX = '/api/v1/classes/';
const CODE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;

/**
 * Product API for classes in the bound tenant.
 * GET list (C0) + detail (C1) + POST create (C2) + PATCH (IMP-013).
 */
@Injectable()
export class ClassesService {
  constructor(
    private readonly classes: ClassesRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    classId: string,
  ): Promise<GetClassResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(classId)) {
      throw AppError.notFound('Class not found.');
    }
    if (!this.classes.isAvailable()) {
      throw AppError.notFound('Class not found.');
    }
    const row = await this.classes.getByIdForTenant(actorUserId, tenantId, classId);
    if (row === null) {
      throw AppError.notFound('Class not found.');
    }
    return { data: row };
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly academicYearId?: unknown;
      readonly termId?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListClassesResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const academicYearId = parseOptionalUuidFilter(rawQuery.academicYearId, 'academicYearId');
    const termId = parseOptionalUuidFilter(rawQuery.termId, 'termId');
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.classes.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.classes.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      academicYearId,
      termId,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateClassResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateClassRequest(rawBody);
    const bodyJson = JSON.stringify({
      academicYearId: parsed.academicYearId,
      ...(parsed.termId === null ? {} : { termId: parsed.termId }),
      name: parsed.name,
      ...(parsed.code === undefined ? {} : { code: parsed.code }),
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
        return JSON.parse(replay.responseBody) as CreateClassResult;
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
      termId: string | null;
      name: string;
      code: string | undefined;
      status: string;
    },
    correlationId: string,
  ): Promise<CreateClassResult> {
    if (!this.classes.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Class store unavailable.');
    }

    try {
      const row = await this.classes.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        academicYearId: parsed.academicYearId,
        termId: parsed.termId,
        name: parsed.name,
        code: parsed.code,
        status: parsed.status,
      });
      if (row === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create class.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'class.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'class',
          resourceId: row.id,
          metadata: {
            status: parsed.status,
            hasCode: parsed.code !== undefined,
            academicYearId: parsed.academicYearId,
            hasTermId: parsed.termId !== null,
          },
        });
      }

      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Class code already exists for this academic year.');
      }
      if (isParentYearNotFound(error)) {
        throw AppError.validation('academicYearId not found in this tenant.', {
          field: 'academicYearId',
        });
      }
      if (isParentTermNotFound(error)) {
        throw AppError.validation('termId not found in this tenant for the academic year.', {
          field: 'termId',
        });
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid class payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create class.');
    }
  }

  /**
   * PATCH /classes/:id — partial update (academic.manage).
   * Idempotency-Key optional. Missing/cross-tenant → 404.
   */
  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    classId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchClassResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(classId)) {
      throw AppError.notFound('Class not found.');
    }

    const parsed = parsePatchClassRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setName ? { name: parsed.name } : {}),
      ...(parsed.setCode ? { code: parsed.code } : {}),
      ...(parsed.setStatus ? { status: parsed.status } : {}),
      ...(parsed.setAcademicYearId ? { academicYearId: parsed.academicYearId } : {}),
      ...(parsed.setTermId ? { termId: parsed.termId } : {}),
    });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'PATCH',
          route: `${PATCH_ROUTE_PREFIX}${classId}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as PatchClassResult;
      }

      const result = await this.executePatch(actorUserId, tenantId, classId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executePatch(actorUserId, tenantId, classId, parsed, correlationId);
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    classId: string,
    parsed: ParsedClassPatch,
    correlationId: string,
  ): Promise<PatchClassResult> {
    if (!this.classes.isAvailable()) {
      throw AppError.notFound('Class not found.');
    }

    try {
      const row = await this.classes.updateForTenant(actorUserId, tenantId, classId, {
        setName: parsed.setName,
        name: parsed.name,
        setCode: parsed.setCode,
        code: parsed.code,
        setStatus: parsed.setStatus,
        status: parsed.status,
        setAcademicYearId: parsed.setAcademicYearId,
        academicYearId: parsed.academicYearId,
        setTermId: parsed.setTermId,
        termId: parsed.termId,
      });
      if (row === null) {
        throw AppError.notFound('Class not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'class.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'class',
          resourceId: row.id,
          metadata: { fields: parsed.fields },
        });
      }

      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Class code already exists for this academic year.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid class payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update class.');
    }
  }

  /**
   * DELETE /classes/:id — delete when empty (academic.manage) (IMP-014).
   * Missing/cross-tenant/invalid id → 404. Dependents present → 409 CONFLICT.
   */
  async deleteForTenant(
    actorUserId: string,
    tenantId: string,
    classId: string,
    correlationId: string,
  ): Promise<void> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(classId)) {
      throw AppError.notFound('Class not found.');
    }
    if (!this.classes.isAvailable()) {
      throw AppError.notFound('Class not found.');
    }

    try {
      const deleted = await this.classes.deleteForTenant(actorUserId, tenantId, classId);
      if (deleted === null || deleted === false) {
        throw AppError.notFound('Class not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'class.delete',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'class',
          resourceId: classId,
          metadata: {},
        });
      }
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      const dependentsConflict = mapAcademicDeleteDependentsConflict(error, 'class');
      if (dependentsConflict !== null) {
        throw dependentsConflict;
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to delete class.');
    }
  }
}

type ParsedClassPatch = {
  setName: boolean;
  name: string | null;
  setCode: boolean;
  code: string | null;
  setStatus: boolean;
  status: string | null;
  setAcademicYearId: boolean;
  academicYearId: string | null;
  setTermId: boolean;
  termId: string | null;
  fields: string[];
};

function parseStatusFilter(raw: unknown): 'draft' | 'active' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !CLASS_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}

function parseOptionalUuidFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

export function parseCreateClassRequest(raw: unknown): {
  academicYearId: string;
  termId: string | null;
  name: string;
  code: string | undefined;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['academicYearId', 'termId', 'name', 'code', 'status']);
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

  let termId: string | null = null;
  if (body['termId'] !== undefined && body['termId'] !== null && body['termId'] !== '') {
    if (typeof body['termId'] !== 'string' || !isUuid(body['termId'])) {
      throw AppError.validation('termId must be a UUID.', { field: 'termId' });
    }
    termId = body['termId'];
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

  let status = 'draft';
  if (body['status'] !== undefined && body['status'] !== null) {
    if (typeof body['status'] !== 'string' || !CLASS_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', {
        field: 'status',
      });
    }
    status = body['status'];
  }

  return { academicYearId, termId, name, code, status };
}

export function parsePatchClassRequest(raw: unknown): ParsedClassPatch {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'code', 'status', 'academicYearId', 'termId']);
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
  let setStatus = false;
  let status: string | null = null;
  let setAcademicYearId = false;
  let academicYearId: string | null = null;
  let setTermId = false;
  let termId: string | null = null;

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

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body['status'] !== 'string' || !CLASS_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', {
        field: 'status',
      });
    }
    setStatus = true;
    status = body['status'];
    fields.push('status');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'academicYearId')) {
    if (typeof body['academicYearId'] !== 'string' || !isUuid(body['academicYearId'])) {
      throw AppError.validation('academicYearId must be a UUID.', { field: 'academicYearId' });
    }
    setAcademicYearId = true;
    academicYearId = body['academicYearId'];
    fields.push('academicYearId');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'termId')) {
    setTermId = true;
    fields.push('termId');
    if (body['termId'] === null) {
      termId = null;
    } else if (typeof body['termId'] !== 'string' || !isUuid(body['termId'])) {
      throw AppError.validation('termId must be a UUID or null.', { field: 'termId' });
    } else {
      termId = body['termId'];
    }
  }

  if (fields.length === 0) {
    throw AppError.validation('At least one field is required for patch.');
  }

  return {
    setName,
    name,
    setCode,
    code,
    setStatus,
    status,
    setAcademicYearId,
    academicYearId,
    setTermId,
    termId,
    fields,
  };
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

function isParentYearNotFound(error: unknown): boolean {
  if (!isPgInvalidParameter(error)) {
    return false;
  }
  return getErrorMessage(error).toLowerCase().includes('parent academic year not found');
}

function isParentTermNotFound(error: unknown): boolean {
  if (!isPgInvalidParameter(error)) {
    return false;
  }
  return getErrorMessage(error).toLowerCase().includes('parent term not found');
}
