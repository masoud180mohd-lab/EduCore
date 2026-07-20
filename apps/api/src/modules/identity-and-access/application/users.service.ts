import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
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

const USER_STATUSES = new Set(['invited', 'active', 'disabled', 'locked']);

/**
 * Product read API for users visible in the bound tenant (via tenant memberships).
 * No write operations. Role filter deferred (would need clean RBAC join).
 */
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

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
