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
import { UserRolesRepository, type UserRoleRow } from '../repositories/user-roles.repository.js';

export type UserRoleResult = { readonly data: UserRoleRow };
export type ListUserRolesResult = PaginatedResponse<UserRoleRow>;

const USER_ROLES_ROUTE = '/api/v1/user-roles';

@Injectable()
export class UserRolesService {
  constructor(
    private readonly userRoles: UserRolesRepository,
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
      readonly userId?: unknown;
    },
  ): Promise<ListUserRolesResult> {
    this.assertContext(actorUserId, tenantId);
    const pagination = parsePaginationQuery(rawQuery);
    const userId = parseUserIdFilter(rawQuery.userId);
    if (!this.userRoles.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.userRoles.listForTenant(actorUserId, tenantId, {
      ...pagination,
      userId,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async assignForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<UserRoleResult> {
    this.assertContext(actorUserId, tenantId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseAssignUserRoleRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);
    if (this.idempotency === null) {
      return this.executeAssign(actorUserId, tenantId, parsed, correlationId);
    }
    const scopeKey = buildIdempotencyScopeKey(
      { actorUserId, tenantId, method: 'POST', route: USER_ROLES_ROUTE },
      key,
    );
    const bodyHash = hashRequestBody(bodyJson);
    const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
    if (replay !== null) {
      return JSON.parse(replay.responseBody) as UserRoleResult;
    }
    const result = await this.executeAssign(actorUserId, tenantId, parsed, correlationId);
    await this.idempotency.put(scopeKey, {
      bodyHash,
      statusCode: 201,
      responseBody: JSON.stringify(result),
      createdAt: new Date().toISOString(),
    });
    return result;
  }

  async unassignForTenant(
    actorUserId: string,
    tenantId: string,
    userRoleId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<void> {
    this.assertContext(actorUserId, tenantId);
    if (!isUuid(userRoleId)) {
      throw AppError.notFound('User role assignment not found.');
    }
    const key = parseIdempotencyKey(idempotencyKeyHeader);
    const execute = () => this.executeUnassign(actorUserId, tenantId, userRoleId, correlationId);
    if (key === undefined || this.idempotency === null) {
      return execute();
    }
    const scopeKey = buildIdempotencyScopeKey(
      {
        actorUserId,
        tenantId,
        method: 'DELETE',
        route: `${USER_ROLES_ROUTE}/${userRoleId}`,
      },
      assertIdempotencyKey(key),
    );
    const bodyHash = hashRequestBody('{}');
    const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
    if (replay !== null) {
      return;
    }
    await execute();
    await this.idempotency.put(scopeKey, {
      bodyHash,
      statusCode: 204,
      responseBody: '',
      createdAt: new Date().toISOString(),
    });
  }

  private async executeAssign(
    actorUserId: string,
    tenantId: string,
    input: { userId: string; roleId: string },
    correlationId: string,
  ): Promise<UserRoleResult> {
    if (!this.userRoles.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'User role store unavailable.');
    }
    try {
      const assignment = await this.userRoles.assignForTenant(actorUserId, tenantId, {
        userRoleId: randomUUID(),
        ...input,
      });
      if (assignment === null) {
        throw AppError.notFound('User or role not found in this tenant.');
      }
      await this.audit?.publish({
        action: 'user_role.assign',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'user_role',
        resourceId: assignment.id,
        metadata: { userId: assignment.userId, roleId: assignment.roleId },
      });
      return { data: assignment };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'This role is already assigned to the user.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid user role assignment.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to assign user role.');
    }
  }

  private async executeUnassign(
    actorUserId: string,
    tenantId: string,
    userRoleId: string,
    correlationId: string,
  ): Promise<void> {
    if (!this.userRoles.isAvailable()) {
      throw AppError.notFound('User role assignment not found.');
    }
    try {
      const removed = await this.userRoles.unassignForTenant(actorUserId, tenantId, userRoleId);
      if (!removed) {
        throw AppError.notFound('User role assignment not found.');
      }
      await this.audit?.publish({
        action: 'user_role.unassign',
        outcome: 'success',
        correlationId,
        actorUserId,
        tenantId,
        resourceType: 'user_role',
        resourceId: userRoleId,
      });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to unassign user role.');
    }
  }

  private assertContext(actorUserId: string, tenantId: string): void {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
  }
}

export function parseAssignUserRoleRequest(raw: unknown): { userId: string; roleId: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'userId' && key !== 'roleId') {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['userId'] !== 'string' || !isUuid(body['userId'])) {
    throw AppError.validation('userId must be a uuid.', { field: 'userId' });
  }
  if (typeof body['roleId'] !== 'string' || !isUuid(body['roleId'])) {
    throw AppError.validation('roleId must be a uuid.', { field: 'roleId' });
  }
  return { userId: body['userId'].toLowerCase(), roleId: body['roleId'].toLowerCase() };
}

function parseUserIdFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw.trim())) {
    throw AppError.validation('userId must be a uuid.', { field: 'userId' });
  }
  return raw.trim().toLowerCase();
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function isPgUniqueViolation(error: unknown): boolean {
  return isPgCode(error, '23505');
}

function isPgInvalidParameter(error: unknown): boolean {
  return isPgCode(error, '22023');
}
