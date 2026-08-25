'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DigiiNavItem = {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  readonly match?: 'exact' | 'prefix';
};

export type DigiiNavGroup = {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<DigiiNavItem>;
};

type DigiiShellProps = {
  readonly brand: string;
  readonly brandMeta?: string;
  readonly brandHref?: string;
  readonly chipLabel: string;
  readonly navLabel: string;
  /** Flat nav (Platform). Prefer `navGroups` for Admin IA. */
  readonly navItems?: ReadonlyArray<DigiiNavItem>;
  /** Grouped nav — Admin Option A IA (DSF-002). */
  readonly navGroups?: ReadonlyArray<DigiiNavGroup>;
  readonly topActions?: ReactNode;
  /** Content directly under the institutional bar (e.g. Teacher mode tabs). */
  readonly belowHeader?: ReactNode;
  readonly sidebarFooter?: ReactNode;
  readonly onLogout: () => void;
  readonly logoutLabel: string;
  readonly menuLabel: string;
  readonly closeMenuLabel: string;
  readonly children: ReactNode;
  /** CSS color for thin identity strip under the primary bar */
  readonly portalAccent?: string;
};

function isNavCurrent(pathname: string | null, item: DigiiNavItem): boolean {
  if (pathname == null) return false;
  if (item.match === 'exact') return pathname === item.href;
  if (item.href === '/platform') {
    return pathname === '/platform' || pathname.startsWith('/platform/tenants');
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({
  items,
  groups,
  pathname,
  onNavigate,
  navLabel,
}: {
  readonly items?: ReadonlyArray<DigiiNavItem>;
  readonly groups?: ReadonlyArray<DigiiNavGroup>;
  readonly pathname: string | null;
  readonly onNavigate?: () => void;
  readonly navLabel: string;
}) {
  if (groups !== undefined && groups.length > 0) {
    return (
      <nav className="flex flex-col gap-4" aria-label={navLabel}>
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <span className="px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {group.label}
            </span>
            {group.items.map((item) => {
              const active = isNavCurrent(pathname, item);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'text-[var(--foreground)]/80 hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  const flat = items ?? [];
  return (
    <nav className="flex flex-col gap-1" aria-label={navLabel}>
      {flat.map((item) => {
        const active = isNavCurrent(pathname, item);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            {...(onNavigate !== undefined ? { onClick: onNavigate } : {})}
            className={cn(
              'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--foreground)]/80 hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Digii-style institutional chrome (DSF-KIT-002 v1.1): teal top bar + left nav card.
 */
export function DigiiShell({
  brand,
  brandMeta,
  brandHref,
  chipLabel,
  navLabel,
  navItems,
  navGroups,
  topActions,
  belowHeader,
  sidebarFooter,
  onLogout,
  logoutLabel,
  menuLabel,
  closeMenuLabel,
  children,
  portalAccent = 'var(--portal-accent, var(--color-accent))',
}: DigiiShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const homeHref =
    brandHref ??
    navGroups?.[0]?.items[0]?.href ??
    navItems?.[0]?.href ??
    '/';

  return (
    <div className="min-h-dvh bg-[color-mix(in_srgb,var(--color-bg)_92%,var(--color-accent)_8%)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 md:gap-6 md:px-6">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-[var(--primary-foreground)] hover:bg-[var(--primary-foreground)]/15 hover:text-[var(--primary-foreground)] md:hidden"
                aria-label={menuLabel}
              >
                <Menu />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-base font-semibold text-[var(--foreground)]">
                    {brand}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={closeMenuLabel}>
                      <X />
                    </Button>
                  </Dialog.Close>
                </div>
                <NavLinks
                  {...(navItems !== undefined ? { items: navItems } : {})}
                  {...(navGroups !== undefined ? { groups: navGroups } : {})}
                  pathname={pathname}
                  navLabel={navLabel}
                  onNavigate={() => setMobileOpen(false)}
                />
                {sidebarFooter}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Link href={homeHref} className="flex min-w-0 shrink items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-foreground)]/15 ring-1 ring-[var(--primary-foreground)]/30">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            <span className="truncate text-lg font-semibold tracking-tight">{brand}</span>
            {brandMeta ? (
              <span className="hidden shrink-0 text-xs text-[var(--primary-foreground)]/75 sm:inline">
                {brandMeta}
              </span>
            ) : null}
          </Link>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <span className="hidden rounded-full bg-[var(--primary-foreground)]/15 px-2.5 py-1 text-xs font-medium sm:inline">
              {chipLabel}
            </span>
            {topActions}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-[var(--primary-foreground)] hover:bg-[var(--primary-foreground)]/15 hover:text-[var(--primary-foreground)]"
              onClick={onLogout}
              aria-label={logoutLabel}
            >
              <LogOut />
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full" style={{ background: portalAccent }} aria-hidden />
      </header>
      {belowHeader}

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 md:grid-cols-[260px_1fr] md:gap-6 md:px-6 md:py-6">
        <aside className="hidden flex-col gap-4 md:flex" aria-label={navLabel}>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
            <div className="bg-[var(--primary)] px-4 py-5 text-[var(--primary-foreground)]">
              <p className="text-sm font-semibold">{brand}</p>
              <p className="mt-0.5 text-xs text-[var(--primary-foreground)]/80">{chipLabel}</p>
            </div>
            <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto p-3">
              <NavLinks
                {...(navItems !== undefined ? { items: navItems } : {})}
                {...(navGroups !== undefined ? { groups: navGroups } : {})}
                pathname={pathname}
                navLabel={navLabel}
              />
            </div>
          </div>
          {sidebarFooter}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
