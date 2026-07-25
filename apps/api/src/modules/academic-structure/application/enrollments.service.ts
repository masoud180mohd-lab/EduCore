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
  EnrollmentsRepository,
  type EnrollmentRow,
} from '../repositories/enrollments.repository.js';

export type Enrollment = EnrollmentRow;
export type ListEnrollmentsResult = PaginatedResponse<Enrollment>;
export type GetEnrollmentResult = { readonly data: Enrollment };
export type CreateEnrollmentResult = { readonly data: Enrollment };
export type PatchEnrollmentResult = { readonly data: Enrollment };

const STATUSES = new Set(['active', 'withdrawn', 'completed', 'suspended']);
const CREATE_ROUTE = '/api/v1/enrollments';
const PATCH_PREFIX = '/api/v1/enrollments/';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly enrollments: EnrollmentsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    enrollmentId: string,
  ): Promise<GetEnrollmentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(enrollmentId)) throw AppError.notFound('Enrollment not found.');
    if (!this.enrollments.isAvailable()) throw AppError.notFound('Enrollment not found.');
    const row = await this.enrollments.getByIdForTenant(actorUserId, tenantId, enrollmentId);
    if (row === null) throw AppError.notFound('Enrollment not found.');
    return { data: row };
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly studentId?: unknown;
      readonly classId?: unknown;
      readonly academicYearId?: unknown;
      readonly streamId?: unknown;
      readonly status?: unknown;
    },
  ): Promise<ListEnrollmentsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const pagination = parsePaginationQuery(rawQuery);
    const studentId = parseOptionalUuid(rawQuery.studentId, 'studentId');
    const classId = parseOptionalUuid(rawQuery.classId, 'classId');
    const academicYearId = parseOptionalUuid(rawQuery.academicYearId, 'academicYearId');
    const streamId = parseOptionalUuid(rawQuery.streamId, 'streamId');
    const status = parseStatusFilter(rawQuery.status);
    if (!this.enrollments.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.enrollments.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      studentId,
      classId,
      academicYearId,
      streamId,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateEnrollmentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateEnrollmentRequest(rawBody);
    const bodyJson = JSON.stringify({
      studentId: parsed.studentId,
      classId: parsed.classId,
      ...(parsed.streamId === null ? {} : { streamId: parsed.streamId }),
      status: parsed.status,
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: CREATE_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateEnrollmentResult;
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
    enrollmentId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchEnrollmentResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(enrollmentId)) throw AppError.notFound('Enrollment not found.');
    const parsed = parsePatchEnrollmentRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setStatus ? { status: parsed.status } : {}),
      ...(parsed.setClass ? { classId: parsed.classId } : {}),
      ...(parsed.setStream ? { streamId: parsed.streamId } : {}),
    });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'PATCH',
          route: `${PATCH_PREFIX}${enrollmentId}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as PatchEnrollmentResult;
      const result = await this.executePatch(
        actorUserId,
        tenantId,
        enrollmentId,
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
    return this.executePatch(actorUserId, tenantId, enrollmentId, parsed, correlationId);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: {
      studentId: string;
      classId: string;
      streamId: string | null;
      status: string;
    },
    correlationId: string,
  ): Promise<CreateEnrollmentResult> {
    if (!this.enrollments.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Enrollment store unavailable.');
    }
    try {
      const row = await this.enrollments.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        studentId: parsed.studentId,
        classId: parsed.classId,
        streamId: parsed.streamId,
        status: parsed.status,
      });
      if (row === null) throw new AppError('INTERNAL_ERROR', 'Failed to create enrollment.');
      if (this.audit !== null) {
        await this.audit.publish({
          action: 'enrollment.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'enrollment',
          resourceId: row.id,
          metadata: {
            status: parsed.status,
            studentId: parsed.studentId,
            classId: parsed.classId,
            hasStreamId: parsed.streamId !== null,
          },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '23505')) {
        throw new AppError(
          'CONFLICT',
          'An active or suspended enrollment already exists for this student and class in the year.',
        );
      }
      if (isPgCode(error, '22023')) {
        const m = getMsg(error);
        if (m.includes('student not found')) {
          throw AppError.validation('studentId not found in this tenant.', { field: 'studentId' });
        }
        if (m.includes('class not found')) {
          throw AppError.validation('classId not found in this tenant.', { field: 'classId' });
        }
        if (m.includes('stream not found')) {
          throw AppError.validation('streamId not found for this class in this tenant.', {
            field: 'streamId',
          });
        }
        throw AppError.validation('Invalid enrollment payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create enrollment.');
    }
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    enrollmentId: string,
    parsed: ParsedEnrollmentPatch,
    correlationId: string,
  ): Promise<PatchEnrollmentResult> {
    if (!this.enrollments.isAvailable()) {
      throw AppError.notFound('Enrollment not found.');
    }
    try {
      const row = await this.enrollments.patchForTenant(actorUserId, tenantId, enrollmentId, {
        setClass: parsed.setClass,
        classId: parsed.classId,
        setStream: parsed.setStream,
        streamId: parsed.streamId,
        setStatus: parsed.setStatus,
        status: parsed.status,
      });
      if (row === null) throw AppError.notFound('Enrollment not found.');
      if (this.audit !== null) {
        const fields: string[] = [];
        if (parsed.setStatus) fields.push('status');
        if (parsed.setClass) fields.push('classId');
        if (parsed.setStream) fields.push('streamId');
        await this.audit.publish({
          action: 'enrollment.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'enrollment',
          resourceId: row.id,
          metadata: { fields },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '23505')) {
        throw new AppError(
          'CONFLICT',
          'An active or suspended enrollment already exists for this student and class in the year.',
        );
      }
      if (isPgCode(error, '22023')) {
        const m = getMsg(error);
        if (m.includes('class not found')) {
          throw AppError.validation('classId not found in this tenant.', { field: 'classId' });
        }
        if (m.includes('stream not found')) {
          throw AppError.validation('streamId not found for this class in this tenant.', {
            field: 'streamId',
          });
        }
        throw AppError.validation('Invalid enrollment payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update enrollment.');
    }
  }
}

type ParsedEnrollmentPatch = {
  setStatus: boolean;
  status: string | undefined;
  setClass: boolean;
  classId: string | undefined;
  setStream: boolean;
  streamId: string | null | undefined;
};

function parseStatusFilter(
  raw: unknown,
): 'active' | 'withdrawn' | 'completed' | 'suspended' | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !STATUSES.has(raw)) {
    throw AppError.validation('status must be active, withdrawn, completed, or suspended.', {
      field: 'status',
    });
  }
  return raw as 'active' | 'withdrawn' | 'completed' | 'suspended';
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function parseCreateEnrollmentRequest(raw: unknown): {
  studentId: string;
  classId: string;
  streamId: string | null;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!['studentId', 'classId', 'streamId', 'status'].includes(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['studentId'] !== 'string' || !isUuid(body['studentId'])) {
    throw AppError.validation('studentId is required and must be a UUID.', { field: 'studentId' });
  }
  if (typeof body['classId'] !== 'string' || !isUuid(body['classId'])) {
    throw AppError.validation('classId is required and must be a UUID.', { field: 'classId' });
  }
  let streamId: string | null = null;
  if (body['streamId'] !== undefined && body['streamId'] !== null && body['streamId'] !== '') {
    if (typeof body['streamId'] !== 'string' || !isUuid(body['streamId'])) {
      throw AppError.validation('streamId must be a UUID.', { field: 'streamId' });
    }
    streamId = body['streamId'];
  }
  let status = 'active';
  if (body['status'] !== undefined && body['status'] !== null) {
    if (typeof body['status'] !== 'string' || !STATUSES.has(body['status'])) {
      throw AppError.validation('status must be active, withdrawn, completed, or suspended.', {
        field: 'status',
      });
    }
    status = body['status'];
  }
  return { studentId: body['studentId'], classId: body['classId'], streamId, status };
}

function parsePatchEnrollmentRequest(raw: unknown): ParsedEnrollmentPatch {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['status', 'classId', 'streamId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  let setStatus = false;
  let status: string | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    setStatus = true;
    if (typeof body['status'] !== 'string' || !STATUSES.has(body['status'])) {
      throw AppError.validation('status must be active, withdrawn, completed, or suspended.', {
        field: 'status',
      });
    }
    status = body['status'];
  }

  let setClass = false;
  let classId: string | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'classId')) {
    setClass = true;
    if (typeof body['classId'] !== 'string' || !isUuid(body['classId'])) {
      throw AppError.validation('classId must be a UUID.', { field: 'classId' });
    }
    classId = body['classId'];
  }

  let setStream = false;
  let streamId: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'streamId')) {
    setStream = true;
    if (body['streamId'] === null) {
      streamId = null;
    } else if (typeof body['streamId'] === 'string' && isUuid(body['streamId'])) {
      streamId = body['streamId'];
    } else {
      throw AppError.validation('streamId must be a UUID or null.', { field: 'streamId' });
    }
  }

  if (!setStatus && !setClass && !setStream) {
    throw AppError.validation('At least one of status, classId, streamId is required.');
  }

  return { setStatus, status, setClass, classId, setStream, streamId };
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
