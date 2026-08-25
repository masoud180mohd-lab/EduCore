import { apiRequest } from '@/lib/api/client';
import type { SessionAuth } from '@/lib/api/client';
import {
  prefersAdminHome,
  prefersHeadHome,
  prefersParentHome,
  prefersStaffHome,
  prefersStudentHome,
  type MeLike,
} from '@/lib/auth/home-preference';

export type MeEnvelope = {
  readonly data: MeLike;
};

export {
  prefersAdminHome,
  prefersHeadHome,
  prefersParentHome,
  prefersStaffHome,
  prefersStudentHome,
};

export type PostLoginPath =
  | `/platform`
  | `/t/${string}/head`
  | `/t/${string}/admin`
  | `/t/${string}/teacher`
  | `/t/${string}/parent`
  | `/t/${string}/student`;

export async function resolvePostLoginPath(auth: SessionAuth): Promise<PostLoginPath> {
  try {
    const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth, requireTenant: false });
    if (me.data.platformOperator === true) {
      return '/platform';
    }
    // SPEC D2 priority: Head > School Admin > Teacher > Parent > Student
    if (prefersHeadHome(me.data)) {
      return `/t/${auth.tenantId}/head`;
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
    if (prefersStudentHome(me.data)) {
      return `/t/${auth.tenantId}/student`;
    }
  } catch {
    // Fall through to teacher — staff attendance is the safe default.
  }
  return `/t/${auth.tenantId}/teacher`;
}
