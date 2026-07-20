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
import { PolicyEvaluator } from '../../../common/policy/index.js';
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import {
  UsersRepository,
  type TenantMembershipStatus,
  type UserRow,
} from '../repositories/users.repository.js';

/** Public user list item (ACF User — no credential fields). */
export type User = UserRow;

export type ListUsersResult = PaginatedResponse<User>;

export type GetUserResult = {
  readonly data: User;
};

export type PatchUserResult = {
  readonly data: User;
};

const USER_STATUSES = new Set(['invited', 'active', 'disabled', 'locked']);
const PATCH_ROUTE_PREFIX = '/api/v1/users/';

/**
 * Product API for users visible in the bound tenant (via tenant memberships).
 * GET list/detail; PATCH displayName (P17: user.manage OR self).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly policy: PolicyEvaluator,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /users/:id — user detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    actorUserId: string,
    tenantId: string,
    targetUserId: string,
  ): Promise<GetUserResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(targetUserId)) {
      throw AppError.notFound('User not found.');
    }

    if (!this.users.isAvailable()) {
      throw AppError.notFound('User not found.');
    }

    const membershipStatuses = resolveMembershipStatuses(undefined);
    const user = await this.users.getByIdForTenant(
      actorUserId,
      tenantId,
      targetUserId,
      membershipStatuses,
    );
    if (user === null) {
      throw AppError.notFound('User not found.');
    }
    return { data: user };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   * Order: display_name ASC, id ASC (cursor = last user id).
   *
   * ACF Q5: default roster = active membership; `status=invited` includes invited memberships.
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
  ): Promise<ListUsersResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);
    const membershipStatuses = resolveMembershipStatuses(status);

    if (!this.users.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.users.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      membershipStatuses,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * PATCH /users/:id — displayName only.
   * AuthZ: user.manage OR self (path id === actor). Target must be visible (active membership).
   * Optional Idempotency-Key.
   */
  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    targetUserId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchUserResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(targetUserId)) {
      throw AppError.notFound('User not found.');
    }

    await this.assertMayPatchUser(actorUserId, tenantId, targetUserId);

    const parsed = parseUpdateUserRequest(rawBody);
    const bodyJson = JSON.stringify({ displayName: parsed.displayName });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined) {
      const key = assertIdempotencyKey(optionalKey);
      if (this.idempotency !== null) {
        const scopeKey = buildIdempotencyScopeKey(
          {
            actorUserId,
            tenantId,
            method: 'PATCH',
            route: `${PATCH_ROUTE_PREFIX}${targetUserId}`,
          },
          key,
        );
        const bodyHash = hashRequestBody(bodyJson);
        const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
        if (replay !== null) {
          return JSON.parse(replay.responseBody) as PatchUserResult;
        }

        const result = await this.executePatch(
          actorUserId,
          tenantId,
          targetUserId,
          parsed.displayName,
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
    }

    return this.executePatch(
      actorUserId,
      tenantId,
      targetUserId,
      parsed.displayName,
      correlationId,
    );
  }

  private async assertMayPatchUser(
    actorUserId: string,
    tenantId: string,
    targetUserId: string,
  ): Promise<void> {
    const isSelf = actorUserId.toLowerCase() === targetUserId.toLowerCase();
    if (isSelf) {
      return;
    }
    const allowed = await this.policy.hasPermission(actorUserId, tenantId, 'user.manage');
    if (!allowed) {
      throw AppError.forbidden('Missing required permission.', { permission: 'user.manage' });
    }
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    targetUserId: string,
    displayName: string,
    correlationId: string,
  ): Promise<PatchUserResult> {
    if (!this.users.isAvailable()) {
      throw AppError.notFound('User not found.');
    }

    try {
      const user = await this.users.updateDisplayNameForTenant(
        actorUserId,
        tenantId,
        targetUserId,
        displayName,
      );
      if (user === null) {
        throw AppError.notFound('User not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'user.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'user',
          resourceId: targetUserId,
          metadata: { fields: ['displayName'] },
        });
      }

      return { data: user };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid displayName.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to update user.');
    }
  }
}

/**
 * Default directory: active members. `status=invited` → invited memberships (ACF Q5).
 */
export function resolveMembershipStatuses(
  userStatus: 'invited' | 'active' | 'disabled' | 'locked' | undefined,
): ReadonlyArray<TenantMembershipStatus> {
  if (userStatus === 'invited') {
    return ['invited'];
  }
  return ['active'];
}

function parseStatusFilter(raw: unknown): 'invited' | 'active' | 'disabled' | 'locked' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !USER_STATUSES.has(raw)) {
    throw AppError.validation('status must be invited, active, disabled, or locked.', {
      field: 'status',
    });
  }
  return raw as 'invited' | 'active' | 'disabled' | 'locked';
}

/**
 * UpdateUserRequest: displayName only. Reject status and unknown keys.
 */
export function parseUpdateUserRequest(raw: unknown): { displayName: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key === 'status') {
      throw AppError.validation('status cannot be updated via PATCH; use disable flow.', {
        field: 'status',
      });
    }
    if (key !== 'displayName') {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  if (typeof body['displayName'] !== 'string') {
    throw AppError.validation('displayName is required.', { field: 'displayName' });
  }
  const displayName = body['displayName'].trim();
  if (displayName.length < 1 || displayName.length > 120) {
    throw AppError.validation('displayName must be 1–120 characters.', { field: 'displayName' });
  }
  return { displayName };
}

function isPgInvalidParameter(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '22023'
  );
}
