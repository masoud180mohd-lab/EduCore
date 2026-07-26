'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { clearSession, readSession } from '@/lib/auth/session';

const BRAND_FALLBACK = 'EduCore Admin';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

export function AdminShell({
  tenantId,
  children,
}: {
  readonly tenantId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [brand, setBrand] = useState(BRAND_FALLBACK);

  useEffect(() => {
    const session = readSession();
    if (session === null || session.tenantId !== tenantId) {
      router.replace('/login');
      return;
    }
    setReady(true);

    void (async () => {
      try {
        const result = await apiRequest<TenantCurrent>('/api/v1/tenants/current', {
          auth: session,
        });
        setBrand(result.data.name ?? result.data.code ?? BRAND_FALLBACK);
      } catch {
        setBrand(BRAND_FALLBACK);
      }
    })();
  }, [router, tenantId]);

  if (!ready) {
    return (
      <div className="app-shell app-shell-wide">
        <p className="muted">Checking session…</p>
      </div>
    );
  }

  const base = `/t/${tenantId}/admin`;
  const links: ReadonlyArray<{ href: string; label: string; match?: string }> = [
    { href: base, label: 'Home' },
    { href: `${base}/users`, label: 'Users' },
    { href: `${base}/memberships`, label: 'Memberships' },
    { href: `${base}/organizations`, label: 'Orgs' },
    { href: `${base}/students`, label: 'Students' },
    { href: `${base}/guardians`, label: 'Guardians' },
    { href: `${base}/roles`, label: 'Roles' },
    { href: `${base}/academic`, label: 'Academic' },
    { href: `${base}/fees`, label: 'Fees' },
    { href: `${base}/settings`, label: 'Settings' },
  ];

  return (
    <div className="app-shell app-shell-wide">
      <header className="top-nav">
        <strong>{brand}</strong>
        <nav aria-label="Admin">
          {links.map((link) => {
            const current =
              link.href === base
                ? pathname === base
                : pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined}>
                {link.label}
              </Link>
            );
          })}
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
      <p className="muted" style={{ marginTop: '2rem' }}>
        <Link href={`/t/${tenantId}/teacher`}>Open teacher attendance</Link>
      </p>
    </div>
  );
}
