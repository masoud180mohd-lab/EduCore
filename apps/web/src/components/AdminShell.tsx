'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

import { useAppPreferences, useTenantLocaleHint } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
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
import { groupMessageKey, navMessageKey } from '@/lib/i18n/messages';

const BRAND_FALLBACK = 'EduCore Admin';

type TenantCurrent = {
  readonly data: {
    readonly id: string;
    readonly name?: string;
    readonly code?: string;
    readonly primaryLocale?: string;
  };
};

type MeEnvelope = {
  readonly data: MeLike;
};

type NavLink = {
  readonly id: AdminNavId;
  readonly href: (base: string) => string;
};

type GateState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'allowed'; readonly navIds: ReadonlySet<AdminNavId> }
  | {
      readonly kind: 'denied';
      readonly fallback: 'teacher' | 'parent';
    };

const NAV_LINKS: ReadonlyArray<NavLink> = [
  { id: 'home', href: (base) => base },
  { id: 'users', href: (base) => `${base}/users` },
  { id: 'staff', href: (base) => `${base}/staff` },
  { id: 'memberships', href: (base) => `${base}/memberships` },
  { id: 'organizations', href: (base) => `${base}/organizations` },
  { id: 'students', href: (base) => `${base}/students` },
  { id: 'guardians', href: (base) => `${base}/guardians` },
  { id: 'roles', href: (base) => `${base}/roles` },
  { id: 'academic', href: (base) => `${base}/academic` },
  { id: 'attendance', href: (base) => `${base}/attendance` },
  { id: 'exams', href: (base) => `${base}/exams` },
  { id: 'reportCards', href: (base) => `${base}/report-cards` },
  { id: 'fees', href: (base) => `${base}/fees` },
  { id: 'notifications', href: (base) => `${base}/notifications` },
  { id: 'announcements', href: (base) => `${base}/announcements` },
  { id: 'reports', href: (base) => `${base}/reports` },
  { id: 'settings', href: (base) => `${base}/settings` },
];

const NAV_BY_ID = Object.fromEntries(NAV_LINKS.map((l) => [l.id, l])) as Record<
  AdminNavId,
  NavLink
>;

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
  const { t } = useAppPreferences();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [brand, setBrand] = useState(BRAND_FALLBACK);
  const [tenantLocale, setTenantLocale] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useTenantLocaleHint(tenantLocale);

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
          setTenantLocale(result.data.primaryLocale ?? null);
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
        <p className="muted">{t('shell.checkingAccess')}</p>
      </div>
    );
  }

  if (gate.kind === 'denied') {
    const fallbackHref =
      gate.fallback === 'parent' ? `/t/${tenantId}/parent` : `/t/${tenantId}/teacher`;
    return (
      <div className="admin-console-plain">
        <h1>{t('shell.adminUnavailable')}</h1>
        <div className="banner banner-error" role="alert">
          {t('shell.adminUnavailableBody')}
        </div>
        <p className="stack">
          <Link className="btn btn-primary" href={fallbackHref}>
            {gate.fallback === 'parent' ? t('shell.openParent') : t('shell.openTeacher')}
          </Link>
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
          aria-label={t('shell.closeMenu')}
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="admin-console-rail" aria-label={t('common.navOffice')}>
        <div className="admin-console-brand">
          <span className="admin-console-product">EduCore</span>
          <span className="admin-console-product-meta">{t('shell.office')}</span>
        </div>
        <nav aria-label={t('common.navAdmin')} className="admin-nav-groups" id={menuId}>
          {groups.map((group) => (
            <div key={group.id} className="admin-nav-group">
              <span className="admin-nav-group-label" id={`admin-nav-${group.id}`}>
                {t(groupMessageKey(group.id))}
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
                        {t(navMessageKey(id))}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <p className="admin-console-rail-foot">
          <Link href={`/t/${tenantId}/teacher`}>{t('shell.teacherAttendance')}</Link>
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
            {t('shell.menu')}
          </button>
          <strong className="admin-console-school">{brand}</strong>
          <AdminChromeControls />
          <button type="button" className="btn btn-secondary" onClick={logOut}>
            {t('shell.logout')}
          </button>
        </header>
        <main className="admin-console-main">{children}</main>
      </div>
    </div>
  );
}
