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
import {
  GuardiansRepository,
  type GuardianRow,
  type StudentGuardianLinkRow,
} from '../repositories/guardians.repository.js';

export type Guardian = GuardianRow;
export type StudentGuardianLink = StudentGuardianLinkRow;

const GUARDIAN_STATUSES = new Set(['active', 'inactive']);
const RELATIONSHIP_TYPES = new Set(['mother', 'father', 'guardian', 'other']);
const CREATE_ROUTE = '/api/v1/guardians';
const LINK_ROUTE_PREFIX = '/api/v1/guardians/';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly guardians: GuardiansRepository,
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
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<PaginatedResponse<Guardian>> {
    assertActorTenant(actorUserId, tenantId);
    const pagination = parsePaginationQuery(rawQuery);
    const status = parseGuardianStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);
    if (!this.guardians.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.guardians.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getForTenant(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
  ): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(guardianId) || !this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    const row = await this.guardians.getByIdForTenant(actorUserId, tenantId, guardianId);
    if (row === null) throw AppError.notFound('Guardian not found.');
    return { data: row };
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    body: Record<string, unknown>,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateGuardianBody(body);
    const bodyJson = JSON.stringify({
      displayName: parsed.displayName,
      phone: parsed.phone,
      email: parsed.email,
      status: parsed.status,
    });
    const bodyHash = hashRequestBody(bodyJson);

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
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as { data: Guardian };
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
      readonly displayName: string;
      readonly phone: string | null;
      readonly email: string | null;
      readonly status: string;
    },
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    if (!this.guardians.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Guardians service is unavailable.', 503);
    }

    let created: Guardian;
    try {
      created = await this.guardians.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        displayName: parsed.displayName,
        phone: parsed.phone,
        email: parsed.email,
        status: parsed.status,
      });
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }

    await this.safeAudit({
      action: 'guardian.create',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'guardian',
      resourceId: created.id,
    });
    return { data: created };
  }

  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    body: Record<string, unknown>,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(guardianId)) throw AppError.notFound('Guardian not found.');
    const patch = parsePatchGuardianBody(body);
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    let updated: Guardian | null;
    try {
      updated = await this.guardians.updateForTenant(actorUserId, tenantId, guardianId, patch);
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }
    if (updated === null) throw AppError.notFound('Guardian not found.');
    await this.safeAudit({
      action: 'guardian.patch',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'guardian',
      resourceId: guardianId,
    });
    return { data: updated };
  }

  async listLinksForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
  ): Promise<{ readonly data: ReadonlyArray<StudentGuardianLink> }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(guardianId)) throw AppError.notFound('Guardian not found.');
    if (!this.guardians.isAvailable()) return { data: [] };
    const guardian = await this.guardians.getByIdForTenant(actorUserId, tenantId, guardianId);
    if (guardian === null) throw AppError.notFound('Guardian not found.');
    const links = await this.guardians.listLinksForGuardian(actorUserId, tenantId, guardianId);
    return { data: links };
  }

  async listLinksForStudent(
    actorUserId: string,
    tenantId: string,
    studentId: string,
  ): Promise<{ readonly data: ReadonlyArray<StudentGuardianLink> }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(studentId)) throw AppError.notFound('Student not found.');
    if (!this.guardians.isAvailable()) return { data: [] };
    const links = await this.guardians.listLinksForStudent(actorUserId, tenantId, studentId);
    return { data: links };
  }

  async createLinkForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    body: Record<string, unknown>,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<{ readonly data: StudentGuardianLink }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(guardianId)) throw AppError.notFound('Guardian not found.');
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateLinkBody(body);
    const bodyJson = JSON.stringify({ ...parsed, guardianId });
    const bodyHash = hashRequestBody(bodyJson);
    const route = `${LINK_ROUTE_PREFIX}${guardianId}/links`;

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route,
        },
        key,
      );
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as { data: StudentGuardianLink };
      }

      const result = await this.executeCreateLink(
        actorUserId,
        tenantId,
        guardianId,
        parsed,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreateLink(actorUserId, tenantId, guardianId, parsed, correlationId);
  }

  private async executeCreateLink(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    parsed: {
      readonly studentId: string;
      readonly relationshipType: string;
      readonly isPrimary: boolean;
    },
    correlationId: string,
  ): Promise<{ readonly data: StudentGuardianLink }> {
    if (!this.guardians.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Guardians service is unavailable.', 503);
    }

    let created: StudentGuardianLink;
    try {
      created = await this.guardians.createLinkForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        studentId: parsed.studentId,
        guardianId,
        relationshipType: parsed.relationshipType,
        isPrimary: parsed.isPrimary,
      });
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }

    await this.safeAudit({
      action: 'guardian.link.create',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'student_guardian',
      resourceId: created.id,
    });
    return { data: created };
  }

  async endLinkForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    linkId: string,
    correlationId: string,
  ): Promise<{ readonly data: StudentGuardianLink }> {
    assertActorTenant(actorUserId, tenantId);
    if (!isUuid(guardianId) || !isUuid(linkId)) {
      throw AppError.notFound('Link not found.');
    }
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Link not found.');
    }
    let ended: StudentGuardianLink | null;
    try {
      ended = await this.guardians.endLinkForTenant(actorUserId, tenantId, guardianId, linkId);
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }
    if (ended === null) throw AppError.notFound('Link not found.');
    await this.safeAudit({
      action: 'guardian.link.end',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'student_guardian',
      resourceId: linkId,
    });
    return { data: ended };
  }

  async bindUserForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    body: Record<string, unknown>,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    if (!isUuid(guardianId)) throw AppError.notFound('Guardian not found.');
    const userId = parseBindUserBody(body);
    const bodyJson = JSON.stringify({ userId });
    const bodyHash = hashRequestBody(bodyJson);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route: `${LINK_ROUTE_PREFIX}${guardianId}/bind-user`,
        },
        key,
      );
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as { data: Guardian };
      }

      const result = await this.executeBind(
        actorUserId,
        tenantId,
        guardianId,
        userId,
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

    return this.executeBind(actorUserId, tenantId, guardianId, userId, correlationId);
  }

  private async executeBind(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    userId: string,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    let bound: Guardian;
    try {
      bound = await this.guardians.bindUserForTenant(actorUserId, tenantId, guardianId, userId);
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }
    await this.safeAudit({
      action: 'guardian.user.bind',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'guardian',
      resourceId: guardianId,
    });
    return { data: bound };
  }

  async unbindUserForGuardian(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    if (!isUuid(guardianId)) throw AppError.notFound('Guardian not found.');
    const bodyJson = JSON.stringify({ guardianId });
    const bodyHash = hashRequestBody(bodyJson);

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route: `${LINK_ROUTE_PREFIX}${guardianId}/unbind-user`,
        },
        key,
      );
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as { data: Guardian };
      }

      const result = await this.executeUnbind(actorUserId, tenantId, guardianId, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeUnbind(actorUserId, tenantId, guardianId, correlationId);
  }

  private async executeUnbind(
    actorUserId: string,
    tenantId: string,
    guardianId: string,
    correlationId: string,
  ): Promise<{ readonly data: Guardian }> {
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    let unbound: Guardian | null;
    try {
      unbound = await this.guardians.unbindUserForTenant(actorUserId, tenantId, guardianId);
    } catch (error: unknown) {
      mapWriteError(error);
      throw error;
    }
    if (unbound === null) throw AppError.notFound('Guardian not found.');
    await this.safeAudit({
      action: 'guardian.user.unbind',
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'guardian',
      resourceId: guardianId,
    });
    return { data: unbound };
  }

  async getMeGuardian(actorUserId: string, tenantId: string): Promise<{ readonly data: Guardian }> {
    assertActorTenant(actorUserId, tenantId);
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    const row = await this.guardians.getByUserIdForTenant(actorUserId, tenantId, actorUserId);
    if (row === null) throw AppError.notFound('Guardian not found.');
    return { data: row };
  }

  async listMeGuardianLinks(
    actorUserId: string,
    tenantId: string,
  ): Promise<{ readonly data: ReadonlyArray<StudentGuardianLink> }> {
    assertActorTenant(actorUserId, tenantId);
    if (!this.guardians.isAvailable()) {
      return { data: [] };
    }
    const guardian = await this.guardians.getByUserIdForTenant(actorUserId, tenantId, actorUserId);
    if (guardian === null) throw AppError.notFound('Guardian not found.');
    const links = await this.guardians.listLinksForGuardianWithNames(
      actorUserId,
      tenantId,
      guardian.id,
    );
    return { data: links };
  }

  /** Active linked student IDs for the caller’s bound guardian (ACF-013 isolation). */
  async resolveActiveLinkedStudentIds(
    actorUserId: string,
    tenantId: string,
  ): Promise<ReadonlySet<string>> {
    assertActorTenant(actorUserId, tenantId);
    if (!this.guardians.isAvailable()) {
      throw AppError.notFound('Guardian not found.');
    }
    const guardian = await this.guardians.getByUserIdForTenant(actorUserId, tenantId, actorUserId);
    if (guardian === null) {
      throw AppError.notFound('Guardian not found.');
    }
    const links = await this.guardians.listLinksForGuardian(actorUserId, tenantId, guardian.id);
    return new Set(
      links.filter((l) => l.status === 'active').map((l) => l.studentId.toLowerCase()),
    );
  }

  private async safeAudit(input: {
    readonly action: string;
    readonly outcome: 'success' | 'failure';
    readonly correlationId: string;
    readonly actorUserId: string;
    readonly tenantId: string;
    readonly resourceType: string;
    readonly resourceId: string;
  }): Promise<void> {
    if (this.audit === null) return;
    try {
      await this.audit.publish(input);
    } catch {
      // audit must not break product path
    }
  }
}

function assertActorTenant(actorUserId: string, tenantId: string): void {
  if (!isUuid(actorUserId)) throw AppError.unauthorized();
  if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
}

function parseGuardianStatusFilter(value: unknown): 'active' | 'inactive' | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !GUARDIAN_STATUSES.has(value)) {
    throw AppError.validation('status must be active or inactive.', { field: 'status' });
  }
  return value as 'active' | 'inactive';
}

function parseCreateGuardianBody(body: Record<string, unknown>): {
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
} {
  const allowed = new Set(['displayName', 'phone', 'email', 'status']);
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
  const phone = optionalTrimmed(body['phone'], 'phone', 32);
  const email = optionalEmail(body['email']);
  let status = 'active';
  if (body['status'] !== undefined) {
    if (typeof body['status'] !== 'string' || !GUARDIAN_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be active or inactive.', { field: 'status' });
    }
    status = body['status'];
  }
  return { displayName, phone, email, status };
}

function parsePatchGuardianBody(body: Record<string, unknown>): {
  readonly setDisplayName: boolean;
  readonly displayName: string | null;
  readonly setPhone: boolean;
  readonly phone: string | null;
  readonly setEmail: boolean;
  readonly email: string | null;
  readonly setStatus: boolean;
  readonly status: string | null;
} {
  const allowed = new Set(['displayName', 'phone', 'email', 'status']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  let setDisplayName = false;
  let displayName: string | null = null;
  let setPhone = false;
  let phone: string | null = null;
  let setEmail = false;
  let email: string | null = null;
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
  }
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
    setPhone = true;
    phone = optionalTrimmed(body['phone'], 'phone', 32);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    setEmail = true;
    email = optionalEmail(body['email']);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (typeof body['status'] !== 'string' || !GUARDIAN_STATUSES.has(body['status'])) {
      throw AppError.validation('status must be active or inactive.', { field: 'status' });
    }
    setStatus = true;
    status = body['status'];
  }
  if (!setDisplayName && !setPhone && !setEmail && !setStatus) {
    throw AppError.validation('At least one field is required.');
  }
  return {
    setDisplayName,
    displayName,
    setPhone,
    phone,
    setEmail,
    email,
    setStatus,
    status,
  };
}

function parseCreateLinkBody(body: Record<string, unknown>): {
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
} {
  const allowed = new Set(['studentId', 'relationshipType', 'isPrimary']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['studentId'] !== 'string' || !isUuid(body['studentId'])) {
    throw AppError.validation('studentId must be a UUID.', { field: 'studentId' });
  }
  if (
    typeof body['relationshipType'] !== 'string' ||
    !RELATIONSHIP_TYPES.has(body['relationshipType'])
  ) {
    throw AppError.validation('relationshipType must be mother, father, guardian, or other.', {
      field: 'relationshipType',
    });
  }
  let isPrimary = false;
  if (body['isPrimary'] !== undefined) {
    if (typeof body['isPrimary'] !== 'boolean') {
      throw AppError.validation('isPrimary must be a boolean.', { field: 'isPrimary' });
    }
    isPrimary = body['isPrimary'];
  }
  return {
    studentId: body['studentId'].toLowerCase(),
    relationshipType: body['relationshipType'],
    isPrimary,
  };
}

function optionalTrimmed(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw AppError.validation(`${field} must be a string.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) {
    throw AppError.validation(`${field} must be 1–${String(max)} characters.`, { field });
  }
  return trimmed;
}

function optionalEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw AppError.validation('email must be a string.', { field: 'email' });
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 320 || !trimmed.includes('@')) {
    throw AppError.validation('email must be a valid address.', { field: 'email' });
  }
  return trimmed;
}

function parseBindUserBody(body: Record<string, unknown>): string {
  const allowed = new Set(['userId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['userId'] !== 'string' || !isUuid(body['userId'])) {
    throw AppError.validation('userId must be a UUID.', { field: 'userId' });
  }
  return body['userId'].toLowerCase();
}

function mapWriteError(error: unknown): void {
  const code = pgErrorCode(error);
  const message = pgErrorMessage(error);
  if (code === '23505') {
    if (/already bound/i.test(message)) {
      throw new AppError('CONFLICT', 'Guardian or user is already bound.');
    }
    throw new AppError('CONFLICT', 'Duplicate guardian email or active link already exists.');
  }
  if (code === '22023') {
    if (/student not found/i.test(message)) {
      throw AppError.validation('Student not found in this school.', { field: 'studentId' });
    }
    if (/guardian not found/i.test(message)) {
      throw AppError.validation('Guardian not found in this school.', { field: 'guardianId' });
    }
    if (/active membership/i.test(message)) {
      throw AppError.validation('User must have an active membership in this school.', {
        field: 'userId',
      });
    }
    throw AppError.validation('Invalid guardian write.');
  }
}

function pgErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = Reflect.get(error, 'code');
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function pgErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = Reflect.get(error, 'message');
    return typeof value === 'string' ? value : '';
  }
  return '';
}
