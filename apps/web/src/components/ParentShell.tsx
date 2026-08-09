'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { clearSession, readSession } from '@/lib/auth/session';

export function ParentShell({
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

  const homeHref = `/t/${tenantId}/parent`;

  return (
    <div className="app-shell">
      <header className="top-nav">
        <strong>EduCore</strong>
        <nav aria-label="Parent">
          <Link href={homeHref} aria-current={pathname === homeHref ? 'page' : undefined}>
            Home
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
      <main className="page" style={{ maxWidth: '56rem' }}>
        {children}
      </main>
    </div>
  );
}
