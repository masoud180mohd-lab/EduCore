import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { UsersRepository, type UserRow } from '../repositories/users.repository.js';

/** Public user list item (ACF User — no credential fields). */
export type User = UserRow;

export type ListUsersResult = PaginatedResponse<User>;

const USER_STATUSES = new Set(['invited', 'active', 'disabled', 'locked']);
const SEARCH_MAX_LEN = 100;

/**
 * Product read API for users visible in the bound tenant (via active memberships).
 * No write operations. Role filter deferred (would need clean RBAC join).
 */
@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   * Order: display_name ASC, id ASC (cursor = last user id).
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
    const search = parseSearchFilter(rawQuery.search);

    if (!this.users.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.users.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }
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

function parseSearchFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw AppError.validation('search must be a string.', { field: 'search' });
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  if (trimmed.length > SEARCH_MAX_LEN) {
    throw AppError.validation(`search must be at most ${String(SEARCH_MAX_LEN)} characters.`, {
      field: 'search',
    });
  }
  return escapeIlikePattern(trimmed);
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
