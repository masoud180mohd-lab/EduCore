/**
 * Guardian fees isolation helpers (IMP-011 / DSF-005).
 * Client allowlist only — server AuthZ still required.
 */

export type GuardianStudentLink = {
  readonly studentId: string;
  readonly status: string;
};

/** Active linked student IDs only (ended/inactive excluded). */
export function activeLinkedStudentIds(
  links: ReadonlyArray<GuardianStudentLink>,
): ReadonlySet<string> {
  return new Set(links.filter((l) => l.status === 'active').map((l) => l.studentId));
}

export function isStudentInAllowlist(studentId: string, allowlist: ReadonlySet<string>): boolean {
  return allowlist.has(studentId);
}

/**
 * Read-only guardian fees surface: never enable bursar mutations.
 * Kept as an explicit helper for tests and future portal twins.
 */
export function guardianFeesMutationsAllowed(): false {
  return false;
}
