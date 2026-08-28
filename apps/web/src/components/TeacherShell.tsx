'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { DigiiShell } from '@/components/chrome/DigiiShell';
import { DIGII_TOP_ACTIONS_CLASS } from '@/components/chrome/digii-top-actions';
import { WorkspaceSwitcher } from '@/components/chrome/WorkspaceSwitcher';
import { apiRequest } from '@/lib/api/client';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearSession, readSession } from '@/lib/auth/session';
import {
  homeHrefForMode,
  modeFromPathname,
  readStoredTeacherMode,
  resolveTeacherMode,
  visibleTeacherModes,
  writeStoredTeacherMode,
  type TeacherMode,
} from '@/lib/teacher/mode';
import { cn } from '@/lib/utils';

type SessionRow = {
  readonly id: string;
  readonly sessionDate: string;
  readonly status: string;
};

type ExamRow = {
  readonly id: string;
  readonly status: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ModeTabs({
  mode,
  visible,
  onSelect,
  classLabel,
  subjectLabel,
  modeNavLabel,
}: {
  readonly mode: TeacherMode;
  readonly visible: ReadonlySet<TeacherMode>;
  readonly onSelect: (next: TeacherMode) => void;
  readonly classLabel: string;
  readonly subjectLabel: string;
  readonly modeNavLabel: string;
}) {
  if (visible.size < 2) return null;
  return (
    <div className="border-b border-[var(--border)] bg-[var(--card)]">
      <div
        className="mx-auto flex max-w-7xl gap-1 px-3 py-2 md:px-6"
        role="tablist"
        aria-label={modeNavLabel}
      >
        {visible.has('class') ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'class'}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-5',
              mode === 'class'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--foreground)]/80 hover:bg-[var(--muted)]',
            )}
            onClick={() => onSelect('class')}
          >
            {classLabel}
          </button>
        ) : null}
        {visible.has('subject') ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'subject'}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-5',
              mode === 'subject'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--foreground)]/80 hover:bg-[var(--muted)]',
            )}
            onClick={() => onSelect('subject')}
          >
            {subjectLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TeacherShell({
  tenantId,
  children,
}: {
  readonly tenantId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useAppPreferences();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<TeacherMode | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<TeacherMode>>(new Set(['class', 'subject']));
  const [leoLabel, setLeoLabel] = useState('');
  const bootstrapped = useRef(false);

  useEffect(() => {
    setLeoLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    );
  }, []);

  useEffect(() => {
    const session = readSession();
    if (session === null || session.tenantId !== tenantId) {
      router.replace('/login');
      return;
    }
    if (bootstrapped.current) return;

    let cancelled = false;
    void (async () => {
      let me: MeLike = {};
      try {
        const envelope = await apiRequest<{ data: MeLike }>('/api/v1/auth/me', { auth: session });
        me = envelope.data;
      } catch {
        me = { roles: [{ code: 'staff' }] };
      }
      if (cancelled) return;

      const modes = visibleTeacherModes(me);
      setVisible(modes);

      const pathMode = modeFromPathname(pathname);
      if (pathMode !== null && modes.has(pathMode)) {
        setMode(pathMode);
        writeStoredTeacherMode(tenantId, pathMode);
        bootstrapped.current = true;
        setReady(true);
        return;
      }

      let openAttendanceToday = false;
      let openMarksWindow = false;
      try {
        const sessions = await apiRequest<{ data: SessionRow[] }>(
          '/api/v1/attendance-sessions?limit=25',
          { auth: session },
        );
        const today = todayIso();
        openAttendanceToday = (sessions.data ?? []).some(
          (s) => s.sessionDate === today && s.status === 'open',
        );
      } catch {
        /* heuristic only */
      }
      try {
        const exams = await apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', {
          auth: session,
        });
        openMarksWindow = (exams.data ?? []).some(
          (e) => e.status === 'open' || e.status === 'draft',
        );
      } catch {
        /* heuristic only */
      }
      if (cancelled) return;

      const resolved = resolveTeacherMode({
        visible: modes,
        lastUsed: readStoredTeacherMode(tenantId),
        signals: { openAttendanceToday, openMarksWindow },
      });
      setMode(resolved);
      writeStoredTeacherMode(tenantId, resolved);
      bootstrapped.current = true;
      setReady(true);

      if (pathname === `/t/${tenantId}/teacher` && resolved === 'subject') {
        router.replace(homeHrefForMode(tenantId, resolved));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tenantId, pathname]);

  useEffect(() => {
    if (!ready || mode === null) return;
    const pathMode = modeFromPathname(pathname);
    if (pathMode !== null && pathMode !== mode && visible.has(pathMode)) {
      setMode(pathMode);
      writeStoredTeacherMode(tenantId, pathMode);
    }
  }, [pathname, ready, mode, visible, tenantId]);

  function selectMode(next: TeacherMode): void {
    setMode(next);
    writeStoredTeacherMode(tenantId, next);
    router.push(homeHrefForMode(tenantId, next));
  }

  if (!ready || mode === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
        {t('teacher.checking')}
      </div>
    );
  }

  const homeHref = `/t/${tenantId}/teacher`;
  const attendHref = `/t/${tenantId}/teacher/attendance`;
  const marksHref = `/t/${tenantId}/teacher/marks`;

  const navItems =
    mode === 'subject'
      ? [{ id: 'marks', href: marksHref, label: t('teacher.marks') }]
      : [
          { id: 'sessions', href: homeHref, label: t('teacher.sessions'), match: 'exact' as const },
          { id: 'attend', href: attendHref, label: t('teacher.attend') },
        ];

  return (
    <DigiiShell
      brand="EduCore"
      brandMeta={t('teacher.nav')}
      brandHref={homeHrefForMode(tenantId, mode)}
      chipLabel={t('teacher.nav')}
      navLabel={t('teacher.nav')}
      portalAccent="#4f6b0f"
      menuLabel={t('shell.menu')}
      closeMenuLabel={t('shell.closeMenu')}
      logoutLabel={t('shell.logout')}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      navItems={navItems}
      topActions={
        <div className={DIGII_TOP_ACTIONS_CLASS}>
          <WorkspaceSwitcher tenantId={tenantId} />
          <AdminChromeControls />
        </div>
      }
      belowHeader={
        <ModeTabs
          mode={mode}
          visible={visible}
          onSelect={selectMode}
          classLabel={t('teacher.modeClass')}
          subjectLabel={t('teacher.modeSubject')}
          modeNavLabel={t('teacher.modeNav')}
        />
      }
    >
      <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {t('teacher.leo')}
          </p>
          <p className="text-base font-semibold">
            <span suppressHydrationWarning>{leoLabel !== '' ? `${leoLabel} · ` : null}</span>
            {mode === 'class' ? t('teacher.modeClass') : t('teacher.modeSubject')}
          </p>
        </div>
        {children}
      </div>
    </DigiiShell>
  );
}
