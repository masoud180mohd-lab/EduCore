'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

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
        <p className="muted">Checking session…</p>
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
        <nav aria-label="Teacher">
          <Link href={homeHref} aria-current={pathname === homeHref ? 'page' : undefined}>
            Sessions
          </Link>
          <Link
            href={attendHref}
            aria-current={pathname?.includes('/attendance') ? 'page' : undefined}
          >
            Attend
          </Link>
          <Link href={marksHref} aria-current={pathname?.includes('/marks') ? 'page' : undefined}>
            Marks
          </Link>
        </nav>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
        >
          Log out
        </button>
      </header>
      {children}
    </div>
  );
}
