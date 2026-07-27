'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import {
  adminDeniedFallback,
  canAccessAdminShell,
  groupAdminNav,
  visibleAdminNavIds,
  type AdminNavId,
} from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearSession, readSession } from '@/lib/auth/session';

const BRAND_FALLBACK = 'EduCore Admin';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

type MeEnvelope = {
  readonly data: MeLike;
};

type NavLink = {
  readonly id: AdminNavId;
  readonly href: (base: string) => string;
  readonly label: string;
};

type GateState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'allowed'; readonly navIds: ReadonlySet<AdminNavId> }
  | {
      readonly kind: 'denied';
      readonly fallback: 'teacher' | 'parent';
    };

/** Flat catalog — presentation is grouped via `groupAdminNav` (IMP-029). Routes unchanged. */
const NAV_LINKS: ReadonlyArray<NavLink> = [
  { id: 'home', href: (base) => base, label: 'Home' },
  { id: 'users', href: (base) => `${base}/users`, label: 'Users' },
  { id: 'memberships', href: (base) => `${base}/memberships`, label: 'Memberships' },
  { id: 'organizations', href: (base) => `${base}/organizations`, label: 'Orgs' },
  { id: 'students', href: (base) => `${base}/students`, label: 'Students' },
  { id: 'guardians', href: (base) => `${base}/guardians`, label: 'Guardians' },
  { id: 'roles', href: (base) => `${base}/roles`, label: 'Roles' },
  { id: 'academic', href: (base) => `${base}/academic`, label: 'Academic' },
  { id: 'fees', href: (base) => `${base}/fees`, label: 'Fees' },
  { id: 'settings', href: (base) => `${base}/settings`, label: 'Settings' },
];

const NAV_BY_ID = Object.fromEntries(NAV_LINKS.map((l) => [l.id, l])) as Record<
  AdminNavId,
  NavLink
>;

/**
 * Admin chrome (DSF-002 / IMP-033 / IMP-029).
 * Session + tenant bind first; then /auth/me capability gate.
 * Nav is permission-filtered and grouped for tablet — API remains AuthZ truth.
 */
export function AdminShell({
  tenantId,
  children,
}: {
  readonly tenantId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [brand, setBrand] = useState(BRAND_FALLBACK);

  useEffect(() => {
    const session = readSession();
    if (session === null || session.tenantId !== tenantId) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth: session });
        if (cancelled) return;
        if (!canAccessAdminShell(me.data)) {
          setGate({ kind: 'denied', fallback: adminDeniedFallback(me.data) });
          return;
        }
        setGate({ kind: 'allowed', navIds: visibleAdminNavIds(me.data) });
      } catch {
        if (cancelled) return;
        setGate({ kind: 'denied', fallback: 'teacher' });
        return;
      }

      try {
        const result = await apiRequest<TenantCurrent>('/api/v1/tenants/current', {
          auth: session,
        });
        if (!cancelled) {
          setBrand(result.data.name ?? result.data.code ?? BRAND_FALLBACK);
        }
      } catch {
        if (!cancelled) setBrand(BRAND_FALLBACK);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tenantId]);

  if (gate.kind === 'loading') {
    return (
      <div className="app-shell app-shell-wide">
        <p className="muted">Checking access…</p>
      </div>
    );
  }

  if (gate.kind === 'denied') {
    const fallbackHref =
      gate.fallback === 'parent' ? `/t/${tenantId}/parent` : `/t/${tenantId}/teacher`;
    return (
      <div className="app-shell app-shell-wide">
        <h1>Admin unavailable</h1>
        <div className="banner banner-error" role="alert">
          You do not have access to Admin for this school. Sign in with an admin account, or open
          your teacher/parent workspace.
        </div>
        <p className="stack">
          <Link className="btn btn-primary" href={fallbackHref}>
            {gate.fallback === 'parent' ? 'Open parent portal' : 'Open teacher workspace'}
          </Link>
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
        </p>
      </div>
    );
  }

  const base = `/t/${tenantId}/admin`;
  const groups = groupAdminNav(gate.navIds);

  function isCurrent(href: string): boolean {
    if (href === base) return pathname === base;
    return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  }

  return (
    <div className="app-shell app-shell-wide">
      <header className="top-nav top-nav-grouped">
        <strong className="top-nav-brand">{brand}</strong>
        <nav aria-label="Admin" className="admin-nav-groups">
          {groups.map((group) => (
            <div key={group.id} className="admin-nav-group">
              <span className="admin-nav-group-label" id={`admin-nav-${group.id}`}>
                {group.label}
              </span>
              <ul className="admin-nav-group-links" aria-labelledby={`admin-nav-${group.id}`}>
                {group.items.map((id) => {
                  const link = NAV_BY_ID[id];
                  const href = link.href(base);
                  const current = isCurrent(href);
                  return (
                    <li key={id}>
                      <Link href={href} aria-current={current ? 'page' : undefined}>
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="btn btn-secondary top-nav-logout"
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
