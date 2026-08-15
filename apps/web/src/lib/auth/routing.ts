import { apiRequest } from '@/lib/api/client';
import type { SessionAuth } from '@/lib/api/client';
import {
  prefersAdminHome,
  prefersParentHome,
  prefersStaffHome,
  type MeLike,
} from '@/lib/auth/home-preference';

export type MeEnvelope = {
  readonly data: MeLike;
};

export { prefersAdminHome, prefersParentHome, prefersStaffHome };

export async function resolvePostLoginPath(
  auth: SessionAuth,
): Promise<`/platform` | `/t/${string}/admin` | `/t/${string}/teacher` | `/t/${string}/parent`> {
  try {
    const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth, requireTenant: false });
    if (me.data.platformOperator === true) {
      return '/platform';
    }
    if (prefersAdminHome(me.data)) {
      return `/t/${auth.tenantId}/admin`;
    }
    if (prefersStaffHome(me.data)) {
      return `/t/${auth.tenantId}/teacher`;
    }
    if (prefersParentHome(me.data)) {
      return `/t/${auth.tenantId}/parent`;
    }
  } catch {
    // Fall through to teacher — staff attendance is the safe default.
  }
  return `/t/${auth.tenantId}/teacher`;
}
