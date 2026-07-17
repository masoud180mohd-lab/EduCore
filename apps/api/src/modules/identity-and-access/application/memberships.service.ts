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

const MEMBERSHIP_STATUSES = new Set(['invited', 'active', 'suspended', 'removed']);

/**
 * Product read API for memberships in the bound tenant.
 * Scope: tenant roster (ACF 4.6), not cross-tenant "my memberships" (/auth/me).
 * No write operations.
 */
@Injectable()
export class MembershipsService {
  constructor(private readonly memberships: MembershipsRepository) {}

  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: { readonly limit?: unknown; readonly cursor?: unknown; readonly status?: unknown },
  ): Promise<ListMembershipsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);

    if (!this.memberships.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.memberships.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
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
