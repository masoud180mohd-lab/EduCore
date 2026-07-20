/**
 * Shared helpers for optional free-text search filters (ILIKE).
 * Escapes metacharacters so user input cannot widen patterns unexpectedly.
 */

import { AppError } from '../errors/app-error.js';

export const SEARCH_DEFAULT_MAX_LEN = 100;

/**
 * Escape `\`, `%`, and `_` for use inside PostgreSQL `ILIKE … ESCAPE '\'`.
 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Parse optional `search` query: trim, length-cap, then escape for ILIKE.
 * Returns `undefined` when absent/blank.
 */
export function parseOptionalSearchFilter(
  raw: unknown,
  options: { readonly field?: string; readonly maxLength?: number } = {},
): string | undefined {
  const field = options.field ?? 'search';
  const maxLength = options.maxLength ?? SEARCH_DEFAULT_MAX_LEN;

  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw AppError.validation(`${field} must be a string.`, { field });
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw AppError.validation(`${field} must be at most ${String(maxLength)} characters.`, {
      field,
    });
  }
  return escapeIlikePattern(trimmed);
}
