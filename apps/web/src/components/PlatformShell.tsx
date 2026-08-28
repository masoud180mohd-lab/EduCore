'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { DigiiShell } from '@/components/chrome/DigiiShell';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearSession, readSession } from '@/lib/auth/session';

type MeEnvelope = {
  readonly data: MeLike;
};

type GateState =
  { readonly kind: 'loading' } | { readonly kind: 'allowed' } | { readonly kind: 'denied' };

export function PlatformShell({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { t } = useAppPreferences();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
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

  if (gate.kind === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
        {t('shell.checkingAccess')}
      </div>
    );
  }

  if (gate.kind === 'denied') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold">{t('platform.forbiddenTitle')}</h1>
        <div
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-4 py-3 text-sm"
          role="alert"
        >
          {t('platform.forbidden')}
        </div>
        <div className="flex flex-wrap gap-2">
          {officeHref !== null ? (
            <Button asChild>
              <Link href={officeHref}>{t('platform.openOffice')}</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
          >
            {t('shell.logout')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DigiiShell
      brand={t('platform.wordmark')}
      brandMeta="Platform"
      chipLabel={t('platform.chip')}
      navLabel={t('platform.nav')}
      portalAccent="#134a6d"
      menuLabel={t('shell.menu')}
      closeMenuLabel={t('shell.closeMenu')}
      logoutLabel={t('shell.logout')}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      navItems={[
        { id: 'schools', href: '/platform', label: t('platform.schools') },
        { id: 'audit', href: '/platform/audit', label: t('platform.audit') },
      ]}
      topActions={
        <>
          {officeHref !== null ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-[var(--primary-foreground)] hover:bg-[var(--primary-foreground)]/15 hover:text-[var(--primary-foreground)] sm:inline-flex"
            >
              <Link href={officeHref}>{t('platform.openOffice')}</Link>
            </Button>
          ) : null}
          <span className="hidden sm:inline-flex [&_button]:border-[var(--primary-foreground)]/25 [&_button]:bg-[var(--primary-foreground)]/10 [&_button]:text-[var(--primary-foreground)]">
            <AdminChromeControls />
          </span>
        </>
      }
    >
      {children}
    </DigiiShell>
  );
}
