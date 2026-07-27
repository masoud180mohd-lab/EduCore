/**
 * Cursor list helpers for admin registries (IMP-030 / ACF page envelopes).
 * Opaque cursor — do not decode client-side for AuthZ.
 */

export const ADMIN_LIST_DEFAULT_LIMIT = 50;

export type PageMeta = {
  readonly nextCursor: string | null;
  readonly limit: number;
};

export type PaginatedEnvelope<T> = {
  readonly data: ReadonlyArray<T>;
  readonly page?: PageMeta;
};

export type ListQueryInput = {
  readonly limit?: number;
  readonly cursor?: string | null;
  /** Extra query params (search, status, academicYearId, …). Empty/null omitted. */
  readonly filters?: Readonly<Record<string, string | null | undefined>>;
};

/**
 * Build `path?limit=&cursor=&…filters` with encodeURIComponent on values.
 * `path` may already include a leading `/api/v1/...` without a query string.
 */
export function buildListQuery(path: string, input: ListQueryInput = {}): string {
  const limit = input.limit ?? ADMIN_LIST_DEFAULT_LIMIT;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (input.cursor !== undefined && input.cursor !== null && input.cursor !== '') {
    params.set('cursor', input.cursor);
  }
  if (input.filters !== undefined) {
    for (const [key, value] of Object.entries(input.filters)) {
      if (value === undefined || value === null) continue;
      const trimmed = value.trim();
      if (trimmed === '') continue;
      params.set(key, trimmed);
    }
  }
  const qs = params.toString();
  return qs === '' ? path : `${path}?${qs}`;
}

/** Read page meta; missing page → treat as fully loaded (nextCursor null). */
export function readPageMeta(
  envelope: PaginatedEnvelope<unknown>,
  fallbackLimit = ADMIN_LIST_DEFAULT_LIMIT,
): PageMeta {
  const page = envelope.page;
  if (page === undefined) {
    return { nextCursor: null, limit: fallbackLimit };
  }
  return {
    nextCursor: page.nextCursor ?? null,
    limit: typeof page.limit === 'number' ? page.limit : fallbackLimit,
  };
}

/**
 * Append incoming rows; de-dupe by `id` so double Load more does not duplicate.
 * Rows without string `id` are appended as-is (rare).
 */
export function appendById<T extends { readonly id: string }>(
  existing: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
): T[] {
  const seen = new Set(existing.map((row) => row.id));
  const merged = [...existing];
  for (const row of incoming) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

/** True when Load more should be shown. */
export function hasMorePages(nextCursor: string | null | undefined): boolean {
  return nextCursor !== null && nextCursor !== undefined && nextCursor !== '';
}
