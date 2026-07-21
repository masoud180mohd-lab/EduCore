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
import { SubjectsRepository, type SubjectRow } from '../repositories/subjects.repository.js';

export type Subject = SubjectRow;
export type ListSubjectsResult = PaginatedResponse<Subject>;
export type GetSubjectResult = { readonly data: Subject };
export type CreateSubjectResult = { readonly data: Subject };

const STATUSES = new Set(['draft', 'active', 'closed']);
const CREATE_ROUTE = '/api/v1/subjects';
const CODE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;

@Injectable()
export class SubjectsService {
  constructor(
    private readonly subjects: SubjectsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    subjectId: string,
  ): Promise<GetSubjectResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(subjectId)) throw AppError.notFound('Subject not found.');
    if (!this.subjects.isAvailable()) throw AppError.notFound('Subject not found.');
    const row = await this.subjects.getByIdForTenant(actorUserId, tenantId, subjectId);
    if (row === null) throw AppError.notFound('Subject not found.');
    return { data: row };
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListSubjectsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatus(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);
    if (!this.subjects.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.subjects.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
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
  ): Promise<CreateSubjectResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateSubjectRequest(rawBody);
    const bodyJson = JSON.stringify({
      name: parsed.name,
      ...(parsed.code === undefined ? {} : { code: parsed.code }),
      status: parsed.status,
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: CREATE_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateSubjectResult;
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
    parsed: { name: string; code: string | undefined; status: string },
    correlationId: string,
  ): Promise<CreateSubjectResult> {
    if (!this.subjects.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Subject store unavailable.');
    }
    try {
      const row = await this.subjects.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        name: parsed.name,
        code: parsed.code,
        status: parsed.status,
      });
      if (row === null) throw new AppError('INTERNAL_ERROR', 'Failed to create subject.');
      if (this.audit !== null) {
        await this.audit.publish({
          action: 'subject.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'subject',
          resourceId: row.id,
          metadata: { status: parsed.status, hasCode: parsed.code !== undefined },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new AppError('CONFLICT', 'Subject code already exists in this tenant.');
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '22023'
      ) {
        throw AppError.validation('Invalid subject payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create subject.');
    }
  }
}

function parseStatus(raw: unknown): 'draft' | 'active' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', { field: 'status' });
  }
  return raw as 'draft' | 'active' | 'closed';
}

function parseCreateSubjectRequest(raw: unknown): {
  name: string;
  code: string | undefined;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!['name', 'code', 'status'].includes(key)) {
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
    const t = body['code'].trim();
    if (t.length === 0) code = undefined;
    else if (!CODE_PATTERN.test(t)) {
      throw AppError.validation('code has invalid format.', { field: 'code' });
    } else code = t;
  }
  let status = 'draft';
  if (body['status'] !== undefined && body['status'] !== null) {
    if (typeof body['status'] !== 'string' || !STATUSES.has(body['status'])) {
      throw AppError.validation('status must be draft, active, or closed.', { field: 'status' });
    }
    status = body['status'];
  }
  return { name, code, status };
}
