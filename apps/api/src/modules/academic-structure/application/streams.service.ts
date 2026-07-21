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
import { StreamsRepository, type StreamRow } from '../repositories/streams.repository.js';

export type Stream = StreamRow;
export type ListStreamsResult = PaginatedResponse<Stream>;
export type GetStreamResult = { readonly data: Stream };
export type CreateStreamResult = { readonly data: Stream };

const STATUSES = new Set(['draft', 'active', 'closed']);
const CREATE_ROUTE = '/api/v1/streams';
const CODE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;

@Injectable()
export class StreamsService {
  constructor(
    private readonly streams: StreamsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    streamId: string,
  ): Promise<GetStreamResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(streamId)) throw AppError.notFound('Stream not found.');
    if (!this.streams.isAvailable()) throw AppError.notFound('Stream not found.');
    const row = await this.streams.getByIdForTenant(actorUserId, tenantId, streamId);
    if (row === null) throw AppError.notFound('Stream not found.');
    return { data: row };
  }

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly classId?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListStreamsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const pagination = parsePaginationQuery(rawQuery);
    const classId = parseOptionalUuid(rawQuery.classId, 'classId');
    const status = parseStatus(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);
    if (!this.streams.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.streams.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      classId,
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
  ): Promise<CreateStreamResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateStreamRequest(rawBody);
    const bodyJson = JSON.stringify({
      classId: parsed.classId,
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
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateStreamResult;
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
    parsed: { classId: string; name: string; code: string | undefined; status: string },
    correlationId: string,
  ): Promise<CreateStreamResult> {
    if (!this.streams.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Stream store unavailable.');
    }
    try {
      const row = await this.streams.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        classId: parsed.classId,
        name: parsed.name,
        code: parsed.code,
        status: parsed.status,
      });
      if (row === null) throw new AppError('INTERNAL_ERROR', 'Failed to create stream.');
      if (this.audit !== null) {
        await this.audit.publish({
          action: 'stream.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'stream',
          resourceId: row.id,
          metadata: {
            status: parsed.status,
            hasCode: parsed.code !== undefined,
            classId: parsed.classId,
          },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isCode(error, '23505')) {
        throw new AppError('CONFLICT', 'Stream code already exists for this class.');
      }
      if (isCode(error, '22023') && msg(error).includes('parent class not found')) {
        throw AppError.validation('classId not found in this tenant.', { field: 'classId' });
      }
      if (isCode(error, '22023')) throw AppError.validation('Invalid stream payload.');
      throw new AppError('INTERNAL_ERROR', 'Failed to create stream.');
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

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function parseCreateStreamRequest(raw: unknown): {
  classId: string;
  name: string;
  code: string | undefined;
  status: string;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!['classId', 'name', 'code', 'status'].includes(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['classId'] !== 'string' || !isUuid(body['classId'])) {
    throw AppError.validation('classId is required and must be a UUID.', { field: 'classId' });
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
  return { classId: body['classId'], name, code, status };
}

function isCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}

function msg(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'object' && error !== null) {
    const m = (error as Record<string, unknown>)['message'];
    if (typeof m === 'string') return m.toLowerCase();
  }
  return String(error).toLowerCase();
}
