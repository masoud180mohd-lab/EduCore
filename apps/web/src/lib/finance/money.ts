/**
 * TZS money helpers for ACF-012 admin fees UI.
 * API uses integer amountMinor only (ACF-012). Display/input use major units;
 * scale is 100 minor units per 1 TZS (ISO 4217).
 */

export const TZS_MINOR_SCALE = 100;

export function formatTzsMinor(amountMinor: number): string {
  if (!Number.isFinite(amountMinor) || !Number.isInteger(amountMinor)) {
    return 'TZS —';
  }
  const major = amountMinor / TZS_MINOR_SCALE;
  return `TZS ${major.toLocaleString('en-TZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parse major-unit TZS input into amountMinor.
 * Accepts optional thousands separators and up to 2 decimal places.
 * Rejects empty, non-numeric, negative, and >2 fractional digits.
 */
export function parseMajorToMinor(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  const minor = Math.round(major * TZS_MINOR_SCALE);
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return minor;
}

/** @deprecated Prefer parseMajorToMinor — kept as alias for call sites. */
export function parseTzsMinorInput(raw: string): number | null {
  return parseMajorToMinor(raw);
}
