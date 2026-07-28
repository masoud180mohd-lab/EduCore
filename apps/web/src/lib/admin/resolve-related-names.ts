import { apiRequest } from '@/lib/api/client';
import type { SessionAuth } from '@/lib/api/client';

/** Resolve class display names for a small set of ids (student-related lists). */
export async function resolveClassNames(
  auth: SessionAuth,
  classIds: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(classIds.filter((id) => id !== ''))];
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await apiRequest<{ data: { name: string } }>(`/api/v1/classes/${id}`, {
          auth,
        });
        map[id] = res.data.name;
      } catch {
        map[id] = id;
      }
    }),
  );
  return map;
}

/** Resolve guardian display names for link rows (ACF-010 ids-only). */
export async function resolveGuardianNames(
  auth: SessionAuth,
  guardianIds: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(guardianIds.filter((id) => id !== ''))];
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await apiRequest<{ data: { displayName: string } }>(`/api/v1/guardians/${id}`, {
          auth,
        });
        map[id] = res.data.displayName;
      } catch {
        map[id] = id;
      }
    }),
  );
  return map;
}
