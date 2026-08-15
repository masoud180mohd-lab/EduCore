'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { apiRequest } from '@/lib/api/client';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearSession, readSession } from '@/lib/auth/session';

type MeEnvelope = {
  readonly data: MeLike;
};

type GateState = { readonly kind: 'loading' } | { readonly kind: 'allowed' } | { readonly kind: 'denied' };

const NAV = [
  { id: 'schools', href: '/platform' },
  { id: 'plans', href: '/platform' },
  { id: 'audit', href: '/platform/audit' },
] as const;

export function PlatformShell({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuId = useId();
  const { t } = useAppPreferences();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [navOpen, setNavOpen] = useState(false);
  const [officeHref, setOfficeHref] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (session === null) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', {
          auth: session,
          requireTenant: false,
        });
        if (cancelled) return;
        if (me.data.platformOperator !== true) {
          setGate({ kind: 'denied' });
          return;
        }
        setGate({ kind: 'allowed' });
        if (session.tenantId !== '') {
          setOfficeHref(`/t/${session.tenantId}/admin`);
        }
      } catch {
        if (!cancelled) setGate({ kind: 'denied' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

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

  if (gate.kind === 'loading') {
    return (
      <div className="admin-console-plain">
        <p className="muted">{t('shell.checkingAccess')}</p>
      </div>
    );
  }

  if (gate.kind === 'denied') {
    return (
      <div className="admin-console-plain">
        <h1>{t('platform.forbiddenTitle')}</h1>
        <div className="banner banner-error" role="alert">
          {t('platform.forbidden')}
        </div>
        <p className="stack">
          {officeHref !== null ? (
            <Link className="btn btn-primary" href={officeHref}>
              {t('platform.openOffice')}
            </Link>
          ) : null}
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

  function isCurrent(href: string): boolean {
    if (href === '/platform') {
      return pathname === '/platform' || (pathname?.startsWith('/platform/tenants') ?? false);
    }
    return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  }

  function logOut(): void {
    clearSession();
    router.replace('/login');
  }

  return (
    <div
      className={navOpen ? 'admin-console admin-console-nav-open' : 'admin-console'}
      data-portal="platform"
    >
      {navOpen ? (
        <button
          type="button"
          className="admin-console-scrim"
          aria-label={t('shell.closeMenu')}
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="admin-console-rail" aria-label={t('platform.nav')}>
        <div className="admin-console-brand">
          <span className="admin-console-product">EduCore</span>
          <span className="admin-console-product-meta">{t('platform.chip')}</span>
        </div>
        <nav aria-label={t('platform.nav')} className="admin-nav-groups" id={menuId}>
          <div className="admin-nav-group">
            <ul className="admin-nav-group-links">
              {NAV.map((item) => {
                const current = isCurrent(item.href) && item.id !== 'plans';
                const plansCurrent = item.id === 'plans' && pathname === '/platform';
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={current || plansCurrent ? 'page' : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      {item.id === 'schools'
                        ? t('platform.schools')
                        : item.id === 'plans'
                          ? t('platform.plans')
                          : t('platform.audit')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
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
          <strong className="admin-console-school">{t('platform.wordmark')}</strong>
          <span className="portal-chip">{t('platform.chip')}</span>
          {officeHref !== null ? (
            <Link className="btn btn-secondary" href={officeHref}>
              {t('platform.openOffice')}
            </Link>
          ) : null}
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
