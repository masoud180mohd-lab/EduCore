'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAppPreferences, useTenantLocaleHint } from '@/components/AppProviders';
import { AdminChromeControls } from '@/components/chrome/AdminChromeControls';
import { DigiiShell, type DigiiNavGroup } from '@/components/chrome/DigiiShell';
import { DIGII_TOP_ACTIONS_CLASS } from '@/components/chrome/digii-top-actions';
import { WorkspaceSwitcher } from '@/components/chrome/WorkspaceSwitcher';
import { Button } from '@/components/ui/button';
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
  const { t } = useAppPreferences();
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });
  const [brand, setBrand] = useState(BRAND_FALLBACK);
  const [tenantLocale, setTenantLocale] = useState<string | null>(null);

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

  if (gate.kind === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--muted)] text-sm text-[var(--muted-foreground)]">
        {t('shell.checkingAccess')}
      </div>
    );
  }

  if (gate.kind === 'denied') {
    const fallbackHref =
      gate.fallback === 'parent' ? `/t/${tenantId}/parent` : `/t/${tenantId}/teacher`;
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold">{t('shell.adminUnavailable')}</h1>
        <div
          className="rounded-lg border border-[var(--color-danger)]/40 bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-4 py-3 text-sm"
          role="alert"
        >
          {t('shell.adminUnavailableBody')}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={fallbackHref}>
              {gate.fallback === 'parent' ? t('shell.openParent') : t('shell.openTeacher')}
            </Link>
          </Button>
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

  const base = `/t/${tenantId}/admin`;
  const navGroups: DigiiNavGroup[] = groupAdminNav(gate.navIds).map((group) => ({
    id: group.id,
    label: t(groupMessageKey(group.id)),
    items: group.items.map((id) => {
      const href = NAV_BY_ID[id].href(base);
      return {
        id,
        href,
        label: t(navMessageKey(id)),
        match: id === 'home' ? ('exact' as const) : ('prefix' as const),
      };
    }),
  }));

  return (
    <DigiiShell
      brand={brand}
      brandMeta={t('shell.office')}
      brandHref={base}
      chipLabel={t('shell.office')}
      navLabel={t('common.navAdmin')}
      navGroups={navGroups}
      portalAccent="#0f6b5c"
      menuLabel={t('shell.menu')}
      closeMenuLabel={t('shell.closeMenu')}
      logoutLabel={t('shell.logout')}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
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
