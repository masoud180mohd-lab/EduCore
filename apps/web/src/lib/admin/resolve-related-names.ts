import { apiRequest } from '@/lib/api/client';
import type { SessionAuth } from '@/lib/api/client';

/** Ids present in `ids` but not yet labeled in `known` (empty string skipped). */
export function missingNameIds(
  ids: ReadonlyArray<string | null | undefined>,
  known: Record<string, string>,
): string[] {
  return [
    ...new Set(
      ids.filter((id): id is string => typeof id === 'string' && id !== '' && known[id] === undefined),
    ),
  ];
}

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

/** Resolve student display names for list FK columns. */
export async function resolveStudentNames(
  auth: SessionAuth,
  studentIds: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(studentIds.filter((id) => id !== ''))];
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await apiRequest<{ data: { displayName: string } }>(`/api/v1/students/${id}`, {
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

/** Resolve user display names (memberships roster). Falls back to email, then id. */
export async function resolveUserNames(
  auth: SessionAuth,
  userIds: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(userIds.filter((id) => id !== ''))];
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await apiRequest<{
          data: { displayName: string | null; email: string };
        }>(`/api/v1/users/${id}`, { auth });
        const label = res.data.displayName?.trim() || res.data.email;
        map[id] = label !== '' ? label : id;
      } catch {
        map[id] = id;
      }
    }),
  );
  return map;
}

/** Resolve stream display names for enrollment-related lists. */
export async function resolveStreamNames(
  auth: SessionAuth,
  streamIds: ReadonlyArray<string>,
): Promise<Record<string, string>> {
  const unique = [...new Set(streamIds.filter((id) => id !== ''))];
  const map: Record<string, string> = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await apiRequest<{ data: { name: string } }>(`/api/v1/streams/${id}`, {
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
