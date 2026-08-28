'use client';

import type { ReactNode } from 'react';

import { Banner } from '@/components/admin/Banner';
import { useAppPreferences } from '@/components/AppProviders';

/**
 * Shared loading / empty / error / list frame for admin registries (IMP-027/030/028).
 * Does not fetch — pages own data; this only standardizes chrome.
 * Optional `footer` hosts Load more (IMP-030) without implying totals.
 * `variant="table"` renders children as-is (AdminTable); default wraps in `ul.list`.
 */
export function ResourceList({
  loading,
  error,
  empty,
  isEmpty,
  children,
  footer,
  variant = 'list',
}: {
  readonly loading: boolean;
  readonly error?: string | null;
  readonly empty: string;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly variant?: 'list' | 'table';
}) {
  const { t } = useAppPreferences();
  return (
    <div className="resource-list stack">
      {error !== null && error !== undefined && error !== '' ? (
        <Banner tone="error">{error}</Banner>
      ) : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading && isEmpty ? <Banner tone="info">{empty}</Banner> : null}
      {!loading && !isEmpty ? (
        variant === 'table' ? (
          children
        ) : (
          <ul className="list">{children}</ul>
        )
      ) : null}
      {!loading && !isEmpty && footer !== undefined ? footer : null}
    </div>
  );
}
