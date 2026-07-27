import { AppError } from '../../../common/errors/app-error.js';

export type DependentSample = {
  readonly id: string;
  readonly label: string;
};

export type DependentGroup = {
  readonly type: string;
  readonly count: number;
  readonly samples: ReadonlyArray<DependentSample>;
};

function isPgHasDependents(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P0001' &&
    'message' in error &&
    String((error as { message: unknown }).message).includes('has dependents')
  );
}

function getPgDetail(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('detail' in error)) {
    return undefined;
  }
  const detail = (error as Record<string, unknown>)['detail'];
  return typeof detail === 'string' && detail.trim() !== '' ? detail : undefined;
}

function parseDependentGroups(raw: unknown): ReadonlyArray<DependentGroup> | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const dependents = (raw as { dependents?: unknown }).dependents;
  if (!Array.isArray(dependents)) {
    return undefined;
  }
  const groups: DependentGroup[] = [];
  for (const item of dependents) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (typeof row['type'] !== 'string' || typeof row['count'] !== 'number') continue;
    const samplesRaw = row['samples'];
    const samples: DependentSample[] = [];
    if (Array.isArray(samplesRaw)) {
      for (const sample of samplesRaw) {
        if (sample === null || typeof sample !== 'object' || Array.isArray(sample)) continue;
        const s = sample as Record<string, unknown>;
        if (typeof s['id'] === 'string' && typeof s['label'] === 'string') {
          samples.push({ id: s['id'], label: s['label'] });
        }
      }
    }
    groups.push({ type: row['type'], count: row['count'], samples });
  }
  return groups.length > 0 ? groups : undefined;
}

/** Map P0001 has-dependents from app.delete_* helpers to CONFLICT with optional details. */
export function mapAcademicDeleteDependentsConflict(
  error: unknown,
  entityLabel: string,
): AppError | null {
  if (!isPgHasDependents(error)) {
    return null;
  }
  const detail = getPgDetail(error);
  let dependents: ReadonlyArray<DependentGroup> | undefined;
  if (detail !== undefined) {
    try {
      dependents = parseDependentGroups(JSON.parse(detail) as unknown);
    } catch {
      dependents = undefined;
    }
  }
  return new AppError(
    'CONFLICT',
    `Cannot delete ${entityLabel} with dependents.`,
    undefined,
    dependents === undefined ? undefined : { dependents },
  );
}
