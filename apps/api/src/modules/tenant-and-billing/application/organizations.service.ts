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

const ORG_STATUSES = new Set(['active', 'inactive']);

/**
 * Product read API for organizations in the bound tenant.
 * No write operations.
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly organizations: OrganizationsRepository) {}

  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: { readonly limit?: unknown; readonly cursor?: unknown; readonly status?: unknown },
  ): Promise<ListOrganizationsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);

    if (!this.organizations.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.organizations.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
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
