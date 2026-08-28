'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { DigiiShell, type DigiiNavItem } from '@/components/chrome/DigiiShell';
import { DIGII_TOP_ACTIONS_CLASS } from '@/components/chrome/digii-top-actions';
import { WorkspaceSwitcher } from '@/components/chrome/WorkspaceSwitcher';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { canAccessHeadPortal } from '@/lib/auth/head-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearSession, readSession } from '@/lib/auth/session';

type GateState =
  { readonly kind: 'loading' } | { readonly kind: 'allowed' } | { readonly kind: 'denied' };

export function HeadShell({
  tenantId,
  children,
}: {
  readonly tenantId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useAppPreferences();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [schoolName, setSchoolName] = useState('EduCore');

  useEffect(() => {
    const session = readSession();
    if (session === null || session.tenantId !== tenantId) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await apiRequest<{ data: MeLike }>('/api/v1/auth/me', { auth: session });
        if (cancelled) return;
        if (!canAccessHeadPortal(me.data)) {
          setGate({ kind: 'denied' });
          return;
        }
        setGate({ kind: 'allowed' });
      } catch {
        if (!cancelled) setGate({ kind: 'denied' });
        return;
      }

      try {
        const tenant = await apiRequest<{
          data: { readonly name?: string; readonly code?: string };
        }>('/api/v1/tenants/current', { auth: session });
        if (!cancelled) {
          setSchoolName(tenant.data.name ?? tenant.data.code ?? 'EduCore');
        }
      } catch {
        /* keep fallback brand */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tenantId]);

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
        <h1 className="text-xl font-semibold">{t('head.forbiddenTitle')}</h1>
        <div
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-4 py-3 text-sm"
          role="alert"
        >
          {t('head.forbidden')}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/t/${tenantId}/admin`}>{t('platform.openOffice')}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
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

  const base = `/t/${tenantId}/head`;
  const navItems: DigiiNavItem[] = [
    { id: 'dashboard', href: base, label: t('head.dashboard'), match: 'exact' },
    { id: 'approvals', href: `${base}/approvals`, label: t('head.approvals') },
  ];

  return (
    <DigiiShell
      brand={schoolName}
      brandMeta={t('head.chip')}
      brandHref={base}
      chipLabel={t('head.chip')}
      navLabel={t('head.nav')}
      portalAccent="#8a5a13"
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
    >
      {children}
    </DigiiShell>
  );
}
