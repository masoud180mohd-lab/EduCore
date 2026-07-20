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
  AcademicYearsRepository,
  type AcademicYearRow,
} from '../repositories/academic-years.repository.js';

/** Public academic year list item (ACF-003 allowlist). */
export type AcademicYear = AcademicYearRow;

export type ListAcademicYearsResult = PaginatedResponse<AcademicYear>;

const ACADEMIC_YEAR_STATUSES = new Set(['draft', 'active', 'closed']);

/**
 * Product read API for academic years in the bound tenant (IMP-003-P0).
 * No write operations. Terms/classes deferred.
 */
@Injectable()
export class AcademicYearsService {
  constructor(private readonly academicYears: AcademicYearsRepository) {}

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
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
  ): Promise<ListAcademicYearsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.academicYears.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.academicYears.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
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
  if (typeof raw !== 'string' || !ACADEMIC_YEAR_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}
