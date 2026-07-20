import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  OrganizationsRepository,
  type OrganizationRow,
} from '../repositories/organizations.repository.js';

/** Public organization list item (ACF Organization schema). */
export type Organization = OrganizationRow;

export type ListOrganizationsResult = PaginatedResponse<Organization>;

export type GetOrganizationResult = {
  readonly data: Organization;
};

const ORG_STATUSES = new Set(['active', 'inactive']);
const ORG_TYPES = new Set(['school', 'campus', 'department']);
const SEARCH_MAX_LEN = 100;

/**
 * Product read API for organizations in the bound tenant.
 * No write operations.
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly organizations: OrganizationsRepository) {}

  /**
   * GET /organizations/:id — membership-scoped detail in bound tenant.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    userId: string,
    tenantId: string,
    organizationId: string,
  ): Promise<GetOrganizationResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(organizationId)) {
      throw AppError.notFound('Organization not found.');
    }

    if (!this.organizations.isAvailable()) {
      throw AppError.notFound('Organization not found.');
    }

    const org = await this.organizations.getByIdForTenant(userId, tenantId, organizationId);
    if (org === null) {
      throw AppError.notFound('Organization not found.');
    }
    return { data: org };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, orgType, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
      readonly orgType?: unknown;
    },
  ): Promise<ListOrganizationsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const orgType = parseOrgTypeFilter(rawQuery.orgType);
    const search = parseSearchFilter(rawQuery.search);

    if (!this.organizations.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.organizations.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
      orgType,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }
}

function parseStatusFilter(raw: unknown): 'active' | 'inactive' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !ORG_STATUSES.has(raw)) {
    throw AppError.validation('status must be active or inactive.', {
      field: 'status',
    });
  }
  return raw as 'active' | 'inactive';
}

function parseOrgTypeFilter(raw: unknown): 'school' | 'campus' | 'department' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !ORG_TYPES.has(raw)) {
    throw AppError.validation('orgType must be school, campus, or department.', {
      field: 'orgType',
    });
  }
  return raw as 'school' | 'campus' | 'department';
}

/**
 * Optional free-text search; escapes ILIKE metacharacters for the repository.
 */
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
