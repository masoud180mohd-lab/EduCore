import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  MembershipsRepository,
  type MembershipRow,
} from '../repositories/memberships.repository.js';

/** Public membership list item (ACF Membership core fields; nested user deferred). */
export type Membership = MembershipRow;

export type ListMembershipsResult = PaginatedResponse<Membership>;

export type GetMembershipResult = {
  readonly data: Membership;
};

const MEMBERSHIP_STATUSES = new Set(['invited', 'active', 'suspended', 'removed']);

/**
 * Product read API for memberships in the bound tenant.
 * Scope: tenant roster (ACF 4.6), not cross-tenant "my memberships" (/auth/me).
 * No write operations.
 */
@Injectable()
export class MembershipsService {
  constructor(private readonly memberships: MembershipsRepository) {}

  /**
   * GET /memberships/:id — membership detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    userId: string,
    tenantId: string,
    membershipId: string,
  ): Promise<GetMembershipResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(membershipId)) {
      throw AppError.notFound('Membership not found.');
    }

    if (!this.memberships.isAvailable()) {
      throw AppError.notFound('Membership not found.');
    }

    const membership = await this.memberships.getByIdForTenant(userId, tenantId, membershipId);
    if (membership === null) {
      throw AppError.notFound('Membership not found.');
    }
    return { data: membership };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, userId.
   * Response: `{ data, page: { nextCursor, limit } }`.
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly userId?: unknown;
    },
  ): Promise<ListMembershipsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const filterUserId = parseUserIdFilter(rawQuery.userId);

    if (!this.memberships.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.memberships.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      userId: filterUserId,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }
}

function parseStatusFilter(
  raw: unknown,
): 'invited' | 'active' | 'suspended' | 'removed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !MEMBERSHIP_STATUSES.has(raw)) {
    throw AppError.validation('status must be invited, active, suspended, or removed.', {
      field: 'status',
    });
  }
  return raw as 'invited' | 'active' | 'suspended' | 'removed';
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
