'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { DigiiShell } from '@/components/chrome/DigiiShell';
import { DIGII_TOP_ACTIONS_CLASS } from '@/components/chrome/digii-top-actions';
import { WorkspaceSwitcher } from '@/components/chrome/WorkspaceSwitcher';
import { clearSession, readSession } from '@/lib/auth/session';

export function ParentShell({
  tenantId,
  children,
}: {
  readonly tenantId: string;
  readonly children: ReactNode;
}) {
  const router = useRouter();
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
      <div className="flex min-h-dvh items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
        {t('parent.checking')}
      </div>
    );
  }

  const homeHref = `/t/${tenantId}/parent`;

  return (
    <DigiiShell
      brand="EduCore"
      brandMeta={t('parent.nav')}
      brandHref={homeHref}
      chipLabel={t('parent.nav')}
      navLabel={t('parent.nav')}
      portalAccent="#6b0f3f"
      menuLabel={t('shell.menu')}
      closeMenuLabel={t('shell.closeMenu')}
      logoutLabel={t('shell.logout')}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      navItems={[{ id: 'home', href: homeHref, label: t('parent.home'), match: 'exact' }]}
      topActions={
        <div className={DIGII_TOP_ACTIONS_CLASS}>
          <WorkspaceSwitcher tenantId={tenantId} />
          <AdminChromeControls />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[56rem]">{children}</div>
    </DigiiShell>
  );
}
