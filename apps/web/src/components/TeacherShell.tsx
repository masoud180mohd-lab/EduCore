'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { WorkspaceSwitcher } from '@/components/chrome/WorkspaceSwitcher';
import { useAppPreferences } from '@/components/AppProviders';
import { clearSession, readSession } from '@/lib/auth/session';

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

  useEffect(() => {
    const session = readSession();
    if (session === null || session.tenantId !== tenantId) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router, tenantId]);

  if (!ready) {
    return (
      <div className="app-shell">
        <p className="muted">{t('teacher.checking')}</p>
      </div>
    );
  }

  const attendHref = `/t/${tenantId}/teacher/attendance`;
  const marksHref = `/t/${tenantId}/teacher/marks`;
  const homeHref = `/t/${tenantId}/teacher`;

  return (
    <div className="app-shell">
      <header className="top-nav">
        <strong>EduCore</strong>
        <WorkspaceSwitcher tenantId={tenantId} />
        <nav aria-label={t('teacher.nav')}>
          <Link href={homeHref} aria-current={pathname === homeHref ? 'page' : undefined}>
            {t('teacher.sessions')}
          </Link>
          <Link
            href={attendHref}
            aria-current={pathname?.includes('/attendance') ? 'page' : undefined}
          >
            {t('teacher.attend')}
          </Link>
          <Link href={marksHref} aria-current={pathname?.includes('/marks') ? 'page' : undefined}>
            {t('teacher.marks')}
          </Link>
        </nav>
        <AdminChromeControls />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
        >
          {t('shell.logout')}
        </button>
      </header>
      {children}
    </div>
  );
}
