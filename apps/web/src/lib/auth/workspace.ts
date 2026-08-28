import { canAccessAdminShell } from './admin-access';
import { canAccessHeadPortal } from './head-access';
import {
  prefersParentHome,
  prefersStaffHome,
  prefersStudentHome,
  type MeLike,
} from './home-preference';

export type WorkspaceId = 'head' | 'office' | 'teacher' | 'parent' | 'student';

export function workspaceFromPath(pathname: string | null | undefined): WorkspaceId {
  if (pathname === null || pathname === undefined) return 'office';
  if (pathname.includes('/head')) return 'head';
  if (/\/parent(\/|$)/.test(pathname)) return 'parent';
  // Must not match /admin/students
  if (/\/student(\/|$)/.test(pathname)) return 'student';
  if (pathname.includes('/teacher')) return 'teacher';
  return 'office';
}

function canPreviewAllWorkspaces(me: MeLike): boolean {
  const roles = me.roles ?? [];
  return roles.some((r) => r.code === 'owner' || r.code === 'admin');
}

/**
 * Which role shells to offer. API remains AuthZ truth.
 * Owner/admin may preview teacher/parent/student; Head when marks.approve / leader.
 */
export function visibleWorkspaces(me: MeLike): ReadonlyArray<WorkspaceId> {
  const preview = canPreviewAllWorkspaces(me);
  const out: WorkspaceId[] = [];
  if (canAccessHeadPortal(me)) out.push('head');
  if (canAccessAdminShell(me)) out.push('office');
  if (prefersStaffHome(me) || preview) out.push('teacher');
  if (prefersParentHome(me) || preview) out.push('parent');
  if (prefersStudentHome(me) || preview) out.push('student');
  if (out.length === 0) return ['teacher'];
  return out;
}

export function workspaceHref(tenantId: string, id: WorkspaceId): string {
  if (id === 'head') return `/t/${tenantId}/head`;
  if (id === 'teacher') return `/t/${tenantId}/teacher`;
  if (id === 'parent') return `/t/${tenantId}/parent`;
  if (id === 'student') return `/t/${tenantId}/student`;
  return `/t/${tenantId}/admin`;
}
