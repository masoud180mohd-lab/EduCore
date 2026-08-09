/**
 * Resolve class UUID → human label for teacher lists (DSF-001/003 polish).
 */
export type ClassLabelRow = {
  readonly id: string;
  readonly name: string;
  readonly code?: string | null;
};

export function buildClassLabelMap(
  rows: ReadonlyArray<ClassLabelRow>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const code =
      row.code !== undefined && row.code !== null && row.code.trim() !== ''
        ? ` (${row.code.trim()})`
        : '';
    map.set(row.id, `${row.name}${code}`);
  }
  return map;
}

export function formatClassLabel(
  map: ReadonlyMap<string, string>,
  classId: string,
): string {
  return map.get(classId) ?? 'Unknown class';
}
