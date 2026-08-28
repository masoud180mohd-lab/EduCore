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
  AttendanceSessionsRepository,
  type AttendanceRecordRow,
  type AttendanceSessionRow,
} from '../repositories/attendance-sessions.repository.js';

export type AttendanceSession = AttendanceSessionRow;
export type AttendanceRecord = AttendanceRecordRow;

export type ListAttendanceSessionsResult = PaginatedResponse<AttendanceSession>;
export type GetAttendanceSessionResult = { readonly data: AttendanceSession };
export type CreateAttendanceSessionResult = { readonly data: AttendanceSession };
export type CloseAttendanceSessionResult = { readonly data: AttendanceSession };
export type ListAttendanceRecordsResult = { readonly data: readonly AttendanceRecord[] };
export type UpsertAttendanceRecordsResult = { readonly data: readonly AttendanceRecord[] };

const SESSION_STATUSES = new Set(['open', 'closed']);
const RECORD_STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const NOTES_MAX_LEN = 500;

const CREATE_ROUTE = '/api/v1/attendance-sessions';
const RECORDS_SUFFIX = '/records';
const CLOSE_SUFFIX = '/close';

@Injectable()
export class AttendanceSessionsService {
  constructor(
    private readonly sessions: AttendanceSessionsRepository,
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
      readonly classId?: unknown;
      readonly sessionDate?: unknown;
      readonly status?: unknown;
    },
  ): Promise<ListAttendanceSessionsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const pagination = parsePaginationQuery(rawQuery);
    const classId = parseOptionalUuid(rawQuery.classId, 'classId');
    const sessionDate = parseOptionalSessionDate(rawQuery.sessionDate);
    const status = parseSessionStatusFilter(rawQuery.status);

    if (!this.sessions.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.sessions.listSessions(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      classId,
      sessionDate,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async summarizeForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: { readonly sessionDate?: unknown },
  ): Promise<{
    readonly data: {
      readonly sessionDate: string;
      readonly sessionCount: number;
      readonly present: number;
      readonly absent: number;
      readonly late: number;
      readonly excused: number;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const sessionDate = parseOptionalSessionDate(rawQuery.sessionDate) ?? utcToday();
    if (!this.sessions.isAvailable()) {
      return {
        data: {
          sessionDate,
          sessionCount: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        },
      };
    }
    const data = await this.sessions.summarizeForDate(actorUserId, tenantId, sessionDate);
    return { data };
  }

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<GetAttendanceSessionResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(sessionId)) throw AppError.notFound('Attendance session not found.');
    if (!this.sessions.isAvailable()) throw AppError.notFound('Attendance session not found.');

    const row = await this.sessions.getSession(actorUserId, tenantId, sessionId);
    if (row === null) throw AppError.notFound('Attendance session not found.');
    return { data: row };
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateAttendanceSessionResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateSessionRequest(rawBody);
    const bodyJson = JSON.stringify({
      classId: parsed.classId,
      ...(parsed.streamId === null ? {} : { streamId: parsed.streamId }),
      sessionDate: parsed.sessionDate,
      ...(parsed.notes === null ? {} : { notes: parsed.notes }),
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route: CREATE_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CreateAttendanceSessionResult;

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

  async closeForTenant(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CloseAttendanceSessionResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(sessionId)) throw AppError.notFound('Attendance session not found.');

    const route = `${CREATE_ROUTE}/${sessionId}${CLOSE_SUFFIX}`;
    const bodyJson = '{}';
    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);

    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'POST', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as CloseAttendanceSessionResult;

      const result = await this.executeClose(actorUserId, tenantId, sessionId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeClose(actorUserId, tenantId, sessionId, correlationId);
  }

  async listRecordsForTenant(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<ListAttendanceRecordsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(sessionId)) throw AppError.notFound('Attendance session not found.');
    if (!this.sessions.isAvailable()) throw AppError.notFound('Attendance session not found.');

    const session = await this.sessions.getSession(actorUserId, tenantId, sessionId);
    if (session === null) throw AppError.notFound('Attendance session not found.');

    const rows = await this.sessions.listRecords(actorUserId, tenantId, sessionId);
    return { data: rows };
  }

  async upsertRecordsForTenant(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<UpsertAttendanceRecordsResult> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(sessionId)) throw AppError.notFound('Attendance session not found.');

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseUpsertRecordsRequest(rawBody);
    const bodyJson = JSON.stringify({ records: parsed.records });
    const route = `${CREATE_ROUTE}/${sessionId}${RECORDS_SUFFIX}`;

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId, method: 'PUT', route },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) return JSON.parse(replay.responseBody) as UpsertAttendanceRecordsResult;

      const result = await this.executeUpsert(
        actorUserId,
        tenantId,
        sessionId,
        parsed.records,
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

    return this.executeUpsert(actorUserId, tenantId, sessionId, parsed.records, correlationId);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: {
      classId: string;
      streamId: string | null;
      sessionDate: string;
      notes: string | null;
    },
    correlationId: string,
  ): Promise<CreateAttendanceSessionResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Attendance store unavailable.');
    }
    try {
      const row = await this.sessions.createSession(actorUserId, tenantId, {
        id: randomUUID(),
        classId: parsed.classId,
        streamId: parsed.streamId,
        sessionDate: parsed.sessionDate,
        notes: parsed.notes,
      });
      if (row === null)
        throw new AppError('INTERNAL_ERROR', 'Failed to create attendance session.');

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'attendance.session.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'attendance_session',
          resourceId: row.id,
          metadata: {
            classId: parsed.classId,
            hasStreamId: parsed.streamId !== null,
            sessionDate: parsed.sessionDate,
          },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, '23505')) {
        throw new AppError(
          'CONFLICT',
          'An attendance session already exists for this class, stream, and date.',
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
        throw AppError.validation('Invalid attendance session payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create attendance session.');
    }
  }

  private async executeClose(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
    correlationId: string,
  ): Promise<CloseAttendanceSessionResult> {
    if (!this.sessions.isAvailable()) {
      throw AppError.notFound('Attendance session not found.');
    }
    try {
      const row = await this.sessions.closeSession(actorUserId, tenantId, sessionId);
      if (row === null) throw AppError.notFound('Attendance session not found.');

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'attendance.session.close',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'attendance_session',
          resourceId: row.id,
          metadata: { status: row.status },
        });
      }
      return { data: row };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0001') && getMsg(error).includes('already closed')) {
        throw new AppError('CONFLICT', 'Attendance session is already closed.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to close attendance session.');
    }
  }

  private async executeUpsert(
    actorUserId: string,
    tenantId: string,
    sessionId: string,
    records: ReadonlyArray<{ studentId: string; status: string; note: string | null }>,
    correlationId: string,
  ): Promise<UpsertAttendanceRecordsResult> {
    if (!this.sessions.isAvailable()) {
      throw AppError.notFound('Attendance session not found.');
    }

    const session = await this.sessions.getSession(actorUserId, tenantId, sessionId);
    if (session === null) throw AppError.notFound('Attendance session not found.');
    if (session.status === 'closed') {
      throw new AppError('CONFLICT', 'Attendance session is closed.');
    }

    try {
      const rows = await this.sessions.upsertRecords(actorUserId, tenantId, sessionId, records);

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'attendance.records.upsert',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'attendance_session',
          resourceId: sessionId,
          metadata: { recordCount: records.length },
        });
      }
      return { data: rows };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      if (isPgCode(error, 'P0001') && getMsg(error).includes('session closed')) {
        throw new AppError('CONFLICT', 'Attendance session is closed.');
      }
      if (isPgCode(error, '22023')) {
        const m = getMsg(error);
        if (m.includes('session not found')) {
          throw AppError.notFound('Attendance session not found.');
        }
        if (m.includes('student not enrolled')) {
          throw AppError.validation(
            'One or more students are not actively enrolled in this session class.',
            { field: 'records' },
          );
        }
        if (m.includes('invalid status')) {
          throw AppError.validation('status must be present, absent, late, or excused.', {
            field: 'status',
          });
        }
        throw AppError.validation('Invalid attendance records payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to upsert attendance records.');
    }
  }
}

function parseSessionStatusFilter(raw: unknown): 'open' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !SESSION_STATUSES.has(raw)) {
    throw AppError.validation('status must be open or closed.', { field: 'status' });
  }
  return raw as 'open' | 'closed';
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalSessionDate(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    throw AppError.validation('sessionDate must be an ISO date (YYYY-MM-DD).', {
      field: 'sessionDate',
    });
  }
  return parseSessionDate(raw);
}

function parseSessionDate(raw: string): string {
  const trimmed = raw.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    throw AppError.validation('sessionDate must be an ISO date (YYYY-MM-DD).', {
      field: 'sessionDate',
    });
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw AppError.validation('sessionDate must be a valid calendar date.', {
      field: 'sessionDate',
    });
  }
  return trimmed;
}

function parseCreateSessionRequest(raw: unknown): {
  classId: string;
  streamId: string | null;
  sessionDate: string;
  notes: string | null;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!['classId', 'streamId', 'sessionDate', 'notes'].includes(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
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
  if (typeof body['sessionDate'] !== 'string') {
    throw AppError.validation('sessionDate is required (YYYY-MM-DD).', { field: 'sessionDate' });
  }
  const sessionDate = parseSessionDate(body['sessionDate']);
  let notes: string | null = null;
  if (body['notes'] !== undefined && body['notes'] !== null) {
    if (typeof body['notes'] !== 'string') {
      throw AppError.validation('notes must be a string.', { field: 'notes' });
    }
    const trimmed = body['notes'].trim();
    if (trimmed.length > NOTES_MAX_LEN) {
      throw AppError.validation(`notes must be at most ${String(NOTES_MAX_LEN)} characters.`, {
        field: 'notes',
      });
    }
    notes = trimmed === '' ? null : trimmed;
  }
  return { classId: body['classId'], streamId, sessionDate, notes };
}

function parseUpsertRecordsRequest(raw: unknown): {
  records: ReadonlyArray<{ studentId: string; status: string; note: string | null }>;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'records') {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (!Array.isArray(body['records'])) {
    throw AppError.validation('records is required and must be an array.', { field: 'records' });
  }
  if (body['records'].length === 0) {
    throw AppError.validation('records must contain at least one item.', { field: 'records' });
  }
  const records = body['records'].map((item, index) => parseRecordItem(item, index));
  return { records };
}

function parseRecordItem(
  raw: unknown,
  index: number,
): {
  studentId: string;
  status: string;
  note: string | null;
} {
  const prefix = `records[${String(index)}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation(`${prefix} must be an object.`, { field: 'records' });
  }
  const item = raw as Record<string, unknown>;
  for (const key of Object.keys(item)) {
    if (!['studentId', 'status', 'note'].includes(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof item['studentId'] !== 'string' || !isUuid(item['studentId'])) {
    throw AppError.validation(`${prefix}.studentId must be a UUID.`, { field: 'studentId' });
  }
  if (typeof item['status'] !== 'string' || !RECORD_STATUSES.has(item['status'])) {
    throw AppError.validation(`${prefix}.status must be present, absent, late, or excused.`, {
      field: 'status',
    });
  }
  let note: string | null = null;
  if (item['note'] !== undefined && item['note'] !== null) {
    if (typeof item['note'] !== 'string') {
      throw AppError.validation(`${prefix}.note must be a string.`, { field: 'note' });
    }
    const trimmed = item['note'].trim();
    if (trimmed.length > NOTES_MAX_LEN) {
      throw AppError.validation(`note must be at most ${String(NOTES_MAX_LEN)} characters.`, {
        field: 'note',
      });
    }
    note = trimmed === '' ? null : trimmed;
  }
  return { studentId: item['studentId'], status: item['status'], note };
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
