'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

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
  { id: 'organizations', href: (base) => `${base}/organizations`, label: 'Organizations' },
  { id: 'students', href: (base) => `${base}/students`, label: 'Students' },
  { id: 'guardians', href: (base) => `${base}/guardians`, label: 'Guardians' },
  { id: 'roles', href: (base) => `${base}/roles`, label: 'Roles' },
  { id: 'academic', href: (base) => `${base}/academic`, label: 'Academic' },
  { id: 'fees', href: (base) => `${base}/fees`, label: 'Fees' },
  { id: 'notifications', href: (base) => `${base}/notifications`, label: 'SMS' },
  { id: 'settings', href: (base) => `${base}/settings`, label: 'Settings' },
];

const NAV_BY_ID = Object.fromEntries(NAV_LINKS.map((l) => [l.id, l])) as Record<
  AdminNavId,
  NavLink
>;

/**
 * Admin chrome (DSF-002 / DSF-KIT-001 / IMP-033 / IMP-029 / IMP-046).
 * Session + tenant bind first; then /auth/me capability gate.
 * Nav is permission-filtered and grouped — API remains AuthZ truth.
 * Layout is a left rail + utility bar (office console), not a wrapped top strip.
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
  const menuId = useId();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [brand, setBrand] = useState(BRAND_FALLBACK);
  const [navOpen, setNavOpen] = useState(false);

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

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setNavOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  if (gate.kind === 'loading') {
    return (
      <div className="admin-console-plain">
        <p className="muted">Checking access…</p>
      </div>
    );
  }

  if (gate.kind === 'denied') {
    const fallbackHref =
      gate.fallback === 'parent' ? `/t/${tenantId}/parent` : `/t/${tenantId}/teacher`;
    return (
      <div className="admin-console-plain">
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

  function logOut(): void {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className={navOpen ? 'admin-console admin-console-nav-open' : 'admin-console'}>
      {navOpen ? (
        <button
          type="button"
          className="admin-console-scrim"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="admin-console-rail" aria-label="Office navigation">
        <div className="admin-console-brand">
          <span className="admin-console-product">EduCore</span>
          <span className="admin-console-product-meta">Office</span>
        </div>
        <nav aria-label="Admin" className="admin-nav-groups" id={menuId}>
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
                      <Link
                        href={href}
                        aria-current={current ? 'page' : undefined}
                        onClick={() => setNavOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <p className="admin-console-rail-foot">
          <Link href={`/t/${tenantId}/teacher`}>Teacher attendance</Link>
        </p>
      </aside>
      <div className="admin-console-workspace">
        <header className="admin-console-top">
          <button
            type="button"
            className="btn btn-secondary admin-console-menu"
            aria-expanded={navOpen}
            aria-controls={menuId}
            onClick={() => setNavOpen((open) => !open)}
          >
            Menu
          </button>
          <strong className="admin-console-school">{brand}</strong>
          <button type="button" className="btn btn-secondary" onClick={logOut}>
            Log out
          </button>
        </header>
        <main className="admin-console-main">{children}</main>
      </div>
    </div>
  );
}
