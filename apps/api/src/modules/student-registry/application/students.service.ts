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
import { StudentsRepository, type StudentRow } from '../repositories/students.repository.js';

/** Public student item (ACF-002 Student allowlist — list + detail + create + patch). */
export type Student = StudentRow;

export type ListStudentsResult = PaginatedResponse<Student>;

export type GetStudentResult = {
  readonly data: Student;
};

export type CreateStudentResult = {
  readonly data: Student;
};

export type PatchStudentResult = {
  readonly data: Student;
};

const STUDENT_STATUSES = new Set(['active', 'inactive', 'graduated', 'transferred', 'draft']);
const CREATE_ROUTE = '/api/v1/students';
const PATCH_ROUTE_PREFIX = '/api/v1/students/';
const CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Product API for students in the bound tenant.
 * GET list (P0) + detail (P1) + POST create (P2) + PATCH (P3).
 * Grade/class filters deferred. No DELETE.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly students: StudentsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /students/:id — detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    actorUserId: string,
    tenantId: string,
    studentId: string,
  ): Promise<GetStudentResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(studentId)) {
      throw AppError.notFound('Student not found.');
    }

    if (!this.students.isAvailable()) {
      throw AppError.notFound('Student not found.');
    }

    const student = await this.students.getByIdForTenant(actorUserId, tenantId, studentId);
    if (student === null) {
      throw AppError.notFound('Student not found.');
    }
    return { data: student };
  }

  async summarizeForTenant(
    actorUserId: string,
    tenantId: string,
  ): Promise<{ readonly data: { readonly total: number; readonly byStatus: Readonly<Record<string, number>> } }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.students.isAvailable()) {
      return { data: { total: 0, byStatus: {} } };
    }
    const summary = await this.students.summarizeForTenant(actorUserId, tenantId);
    return { data: summary };
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
  ): Promise<ListStudentsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.students.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.students.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * POST /students — create (Idempotency-Key required).
   * tenantId always from bound context, never body.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateStudentResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateStudentRequest(rawBody);
    const bodyJson = JSON.stringify({
      displayName: parsed.displayName,
      ...(parsed.studentCode === undefined ? {} : { studentCode: parsed.studentCode }),
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
        return JSON.parse(replay.responseBody) as CreateStudentResult;
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
      displayName: string;
      studentCode: string | undefined;
      status: string;
    },
    correlationId: string,
  ): Promise<CreateStudentResult> {
    if (!this.students.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Student store unavailable.');
    }

    try {
      const student = await this.students.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        displayName: parsed.displayName,
        studentCode: parsed.studentCode,
        status: parsed.status,
      });
      if (student === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create student.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'student.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'student',
          resourceId: student.id,
          metadata: {
            status: parsed.status,
            // Avoid logging full display names if policies tighten later; code only.
            hasStudentCode: parsed.studentCode !== undefined,
          },
        });
      }

      return { data: student };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Student code already exists in this tenant.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid student payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create student.');
    }
  }

  /**
   * PATCH /students/:id — partial update (student.manage).
   * Idempotency-Key optional. Missing/cross-tenant → 404.
   */
  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    studentId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchStudentResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(studentId)) {
      throw AppError.notFound('Student not found.');
    }

    const parsed = parseUpdateStudentRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setDisplayName ? { displayName: parsed.displayName } : {}),
      ...(parsed.setStudentCode ? { studentCode: parsed.studentCode } : {}),
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
          route: `${PATCH_ROUTE_PREFIX}${studentId}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as PatchStudentResult;
      }

      const result = await this.executePatch(
        actorUserId,
        tenantId,
        studentId,
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

    return this.executePatch(actorUserId, tenantId, studentId, parsed, correlationId);
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    studentId: string,
    parsed: ParsedStudentPatch,
    correlationId: string,
  ): Promise<PatchStudentResult> {
    if (!this.students.isAvailable()) {
      throw AppError.notFound('Student not found.');
    }

    try {
      const student = await this.students.updateForTenant(actorUserId, tenantId, studentId, {
        setDisplayName: parsed.setDisplayName,
        displayName: parsed.displayName,
        setStudentCode: parsed.setStudentCode,
        studentCode: parsed.studentCode,
        setStatus: parsed.setStatus,
        status: parsed.status,
      });
      if (student === null) {
        throw AppError.notFound('Student not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'student.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'student',
          resourceId: student.id,
          metadata: { fields: parsed.fields },
        });
      }

      return { data: student };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Student code already exists in this tenant.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid student payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update student.');
    }
  }
}

type ParsedStudentPatch = {
  setDisplayName: boolean;
  displayName: string | null;
  setStudentCode: boolean;
  studentCode: string | null;
  setStatus: boolean;
  status: string | null;
  fields: string[];
};

function parseStatusFilter(
  raw: unknown,
): 'active' | 'inactive' | 'graduated' | 'transferred' | 'draft' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !STUDENT_STATUSES.has(raw)) {
    throw AppError.validation(
      'status must be active, inactive, graduated, transferred, or draft.',
      { field: 'status' },
    );
  }
  return raw as 'active' | 'inactive' | 'graduated' | 'transferred' | 'draft';
}

export function parseCreateStudentRequest(raw: unknown): {
  displayName: string;
  studentCode: string | undefined;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['displayName', 'studentCode', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  if (typeof body['displayName'] !== 'string') {
    throw AppError.validation('displayName is required.', { field: 'displayName' });
  }
  const displayName = body['displayName'].trim();
  if (displayName.length < 1 || displayName.length > 200) {
    throw AppError.validation('displayName must be 1–200 characters.', { field: 'displayName' });
  }

  let studentCode: string | undefined;
  if (body['studentCode'] !== undefined && body['studentCode'] !== null) {
    if (typeof body['studentCode'] !== 'string') {
      throw AppError.validation('studentCode must be a string.', { field: 'studentCode' });
    }
    studentCode = body['studentCode'].trim();
    if (studentCode === '') {
      studentCode = undefined;
    } else if (!CODE_PATTERN.test(studentCode)) {
      throw AppError.validation('studentCode must match ^[A-Za-z0-9._-]{1,64}$.', {
        field: 'studentCode',
      });
    }
  }

  let status = 'active';
  if (body['status'] !== undefined && body['status'] !== null) {
    if (typeof body['status'] !== 'string' || !STUDENT_STATUSES.has(body['status'])) {
      throw AppError.validation(
        'status must be active, inactive, graduated, transferred, or draft.',
        { field: 'status' },
      );
    }
    status = body['status'];
  }

  return { displayName, studentCode, status };
}

export function parseUpdateStudentRequest(raw: unknown): ParsedStudentPatch {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['displayName', 'studentCode', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  const fields: string[] = [];
  let setDisplayName = false;
  let displayName: string | null = null;
  let setStudentCode = false;
  let studentCode: string | null = null;
  let setStatus = false;
  let status: string | null = null;

  if (Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    if (typeof body['displayName'] !== 'string') {
      throw AppError.validation('displayName must be a string.', { field: 'displayName' });
    }
    const trimmed = body['displayName'].trim();
    if (trimmed.length < 1 || trimmed.length > 200) {
      throw AppError.validation('displayName must be 1–200 characters.', { field: 'displayName' });
    }
    setDisplayName = true;
    displayName = trimmed;
    fields.push('displayName');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'studentCode')) {
    setStudentCode = true;
    fields.push('studentCode');
    if (body['studentCode'] === null) {
      studentCode = null;
    } else if (typeof body['studentCode'] !== 'string') {
      throw AppError.validation('studentCode must be a string or null.', { field: 'studentCode' });
    } else {
      const trimmed = body['studentCode'].trim();
      if (trimmed === '') {
        studentCode = null;
      } else if (!CODE_PATTERN.test(trimmed)) {
        throw AppError.validation('studentCode must match ^[A-Za-z0-9._-]{1,64}$.', {
          field: 'studentCode',
        });
      } else {
        studentCode = trimmed;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body['status'] !== 'string' || !STUDENT_STATUSES.has(body['status'])) {
      throw AppError.validation(
        'status must be active, inactive, graduated, transferred, or draft.',
        { field: 'status' },
      );
    }
    setStatus = true;
    status = body['status'];
    fields.push('status');
  }

  if (fields.length === 0) {
    throw AppError.validation('At least one field is required for patch.');
  }

  return {
    setDisplayName,
    displayName,
    setStudentCode,
    studentCode,
    setStatus,
    status,
    fields,
  };
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

function isPgInvalidParameter(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '22023'
  );
}
