import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { ClassesRepository, type ClassRow } from '../repositories/classes.repository.js';

/** Public class item (ACF-005 allowlist). */
export type SchoolClass = ClassRow;

export type ListClassesResult = PaginatedResponse<SchoolClass>;

const CLASS_STATUSES = new Set(['draft', 'active', 'closed']);

/**
 * Product API for classes in the bound tenant.
 * GET list (C0). Detail/create deferred.
 */
@Injectable()
export class ClassesService {
  constructor(private readonly classes: ClassesRepository) {}

  /**
   * Cursor list with optional filters.
   * Query: limit, cursor, academicYearId, termId, status, search.
   */
  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly academicYearId?: unknown;
      readonly termId?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
    },
  ): Promise<ListClassesResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const academicYearId = parseOptionalUuidFilter(rawQuery.academicYearId, 'academicYearId');
    const termId = parseOptionalUuidFilter(rawQuery.termId, 'termId');
    const status = parseStatusFilter(rawQuery.status);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.classes.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.classes.listForTenant(actorUserId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      academicYearId,
      termId,
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
  if (typeof raw !== 'string' || !CLASS_STATUSES.has(raw)) {
    throw AppError.validation('status must be draft, active, or closed.', {
      field: 'status',
    });
  }
  return raw as 'draft' | 'active' | 'closed';
}

function parseOptionalUuidFilter(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}
