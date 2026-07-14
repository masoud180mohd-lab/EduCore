import { AppError } from '../errors/app-error.js';

export const PAGINATION_DEFAULT_LIMIT = 25;
export const PAGINATION_MIN_LIMIT = 1;
export const PAGINATION_MAX_LIMIT = 100;

export type PaginationQuery = {
  readonly limit: number;
  readonly cursor: string | undefined;
};

export type PageMeta = {
  readonly nextCursor: string | null;
  readonly limit: number;
};

export type PaginatedResponse<T> = {
  readonly data: readonly T[];
  readonly page: PageMeta;
};

function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return PAGINATION_DEFAULT_LIMIT;
  }
  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string') {
    value = Number(raw);
  } else {
    throw AppError.validation('limit must be an integer.');
  }
  if (!Number.isInteger(value)) {
    throw AppError.validation('limit must be an integer.');
  }
  if (value < PAGINATION_MIN_LIMIT || value > PAGINATION_MAX_LIMIT) {
    throw AppError.validation(
      `limit must be between ${String(PAGINATION_MIN_LIMIT)} and ${String(PAGINATION_MAX_LIMIT)}.`,
    );
  }
  return value;
}

function parseCursor(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw AppError.validation('cursor must be a string.');
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  // Opaque cursor — reject control characters only; do not decode structure here.
  if (trimmed.length > 512) {
    throw AppError.validation('cursor is too long.');
  }
  return trimmed;
}

/**
 * Parse ACF-001 list query: limit (1–100, default 25) + optional opaque cursor.
 */
export function parsePaginationQuery(query: {
  readonly limit?: unknown;
  readonly cursor?: unknown;
}): PaginationQuery {
  return {
    limit: parseLimit(query.limit),
    cursor: parseCursor(query.cursor),
  };
}

export function buildPaginatedResponse<T>(
  data: readonly T[],
  limit: number,
  nextCursor: string | null,
): PaginatedResponse<T> {
  return {
    data,
    page: {
      nextCursor,
      limit,
    },
  };
}
