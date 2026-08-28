import type { MeLike } from '@/lib/auth/home-preference';

export type TeacherMode = 'class' | 'subject';

export type TeacherModeSignals = {
  readonly openAttendanceToday: boolean;
  readonly openMarksWindow: boolean;
};

const STORAGE_PREFIX = 'educore-teacher-mode:v1:';

export function teacherModeStorageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

export function readStoredTeacherMode(tenantId: string): TeacherMode | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(teacherModeStorageKey(tenantId));
  if (raw === 'class' || raw === 'subject') return raw;
  return null;
}

export function writeStoredTeacherMode(tenantId: string, mode: TeacherMode): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(teacherModeStorageKey(tenantId), mode);
}

/**
 * Which mode tabs the actor may see.
 * Assignment-matrix API is not yet available — staff with neither perm gets both (honest soft default).
 */
export function visibleTeacherModes(me: MeLike): ReadonlySet<TeacherMode> {
  const roles = me.roles ?? [];
  const perms = new Set(me.permissions ?? []);
  const modes = new Set<TeacherMode>();
  const isStaff = roles.some((r) => r.code === 'staff');

  if (perms.has('attendance.manage')) modes.add('class');
  if (perms.has('marks.manage')) modes.add('subject');

  if (modes.size === 0 && isStaff) {
    modes.add('class');
    modes.add('subject');
  }

  return modes;
}

/**
 * SPEC-PORTALS-001 D1 decision table (client-side until portal-preference ACF).
 */
export function resolveTeacherMode(opts: {
  readonly visible: ReadonlySet<TeacherMode>;
  readonly lastUsed: TeacherMode | null;
  readonly signals: TeacherModeSignals;
}): TeacherMode {
  const { visible, lastUsed, signals } = opts;
  if (visible.size === 0) return 'class';
  if (visible.size === 1) {
    return visible.has('subject') ? 'subject' : 'class';
  }

  const { openAttendanceToday, openMarksWindow } = signals;
  if (openAttendanceToday && !openMarksWindow) return 'class';
  if (openMarksWindow && !openAttendanceToday) return 'subject';
  if (openAttendanceToday && openMarksWindow) {
    return lastUsed === 'subject' ? 'subject' : 'class';
  }

  if (lastUsed !== null && visible.has(lastUsed)) return lastUsed;
  return visible.has('class') ? 'class' : 'subject';
}

export function modeFromPathname(pathname: string | null): TeacherMode | null {
  if (pathname == null) return null;
  if (pathname.includes('/teacher/marks')) return 'subject';
  if (pathname.includes('/teacher/attendance')) return 'class';
  if (/\/teacher\/?$/.test(pathname) || pathname.endsWith('/teacher')) return 'class';
  return null;
}

export function homeHrefForMode(tenantId: string, mode: TeacherMode): string {
  return mode === 'subject' ? `/t/${tenantId}/teacher/marks` : `/t/${tenantId}/teacher`;
}
