import { canAccessAdminShell } from './admin-access';
import { prefersParentHome, prefersStaffHome, type MeLike } from './home-preference';

export type WorkspaceId = 'office' | 'teacher' | 'parent';

export function workspaceFromPath(pathname: string | null | undefined): WorkspaceId {
  if (pathname === null || pathname === undefined) return 'office';
  if (pathname.includes('/parent')) return 'parent';
  if (pathname.includes('/teacher')) return 'teacher';
  return 'office';
}

function canPreviewAllWorkspaces(me: MeLike): boolean {
  const roles = me.roles ?? [];
  return roles.some((r) => r.code === 'owner' || r.code === 'admin');
}

/**
 * Which role shells to offer. API remains AuthZ truth.
 * Owner/admin may preview teacher and parent; bursar stays office-only.
 */
export function visibleWorkspaces(me: MeLike): ReadonlyArray<WorkspaceId> {
  const preview = canPreviewAllWorkspaces(me);
  const out: WorkspaceId[] = [];
  if (canAccessAdminShell(me)) out.push('office');
  if (prefersStaffHome(me) || preview) out.push('teacher');
  if (prefersParentHome(me) || preview) out.push('parent');
  if (out.length === 0) return ['teacher'];
  return out;
}

export function workspaceHref(tenantId: string, id: WorkspaceId): string {
  if (id === 'teacher') return `/t/${tenantId}/teacher`;
  if (id === 'parent') return `/t/${tenantId}/parent`;
  return `/t/${tenantId}/admin`;
}
