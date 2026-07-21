import { apiRequest } from '@/lib/api/client';
import type { SessionAuth } from '@/lib/api/client';
import { prefersAdminHome } from '@/lib/auth/home-preference';

export type MeEnvelope = {
  readonly data: {
    readonly roles?: ReadonlyArray<{ readonly code: string }>;
    readonly permissions?: ReadonlyArray<string>;
  };
};

export { prefersAdminHome };

export async function resolvePostLoginPath(
  auth: SessionAuth,
): Promise<`/t/${string}/admin` | `/t/${string}/teacher`> {
  try {
    const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth });
    if (prefersAdminHome(me.data)) {
      return `/t/${auth.tenantId}/admin`;
    }
  } catch {
    // Fall through to teacher — staff attendance is the safe default.
  }
  return `/t/${auth.tenantId}/teacher`;
}
