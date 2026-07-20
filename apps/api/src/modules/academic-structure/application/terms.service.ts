import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { TermsRepository, type TermRow } from '../repositories/terms.repository.js';

/** Public term item (ACF-004 allowlist — list only). */
export type Term = TermRow;

export type ListTermsResult = PaginatedResponse<Term>;

const TERM_STATUSES = new Set(['draft', 'active', 'closed']);

/**
 * Product API for terms in the bound tenant.
 * GET list (P3) only. Detail/create deferred. Years/classes not here.
 */
@Injectable()
export class TermsService {
  constructor(private readonly terms: TermsRepository) {}

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, academicYearId, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   *
   * Cross-tenant / missing academicYearId UUID → empty page (no existence leak).
   * Non-UUID academicYearId → 400 VALIDATION_ERROR.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly academicYearId?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListTermsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const academicYearId = parseOptionalUuidFilter(rawQuery.academicYearId, 'academicYearId');
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.terms.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.terms.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      academicYearId,
      status,
      search,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }
}

function parseStatusFilter(raw: unknown): 'draft' | 'active' | 'closed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !TERM_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}

/**
 * Optional UUID query param. Empty/absent → undefined.
 * Present but not UUID → VALIDATION_ERROR (strict filters; not silent empty).
 */
function parseOptionalUuidFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}
