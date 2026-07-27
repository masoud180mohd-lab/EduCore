import type { ReactNode } from 'react';

import { Banner } from '@/components/admin/Banner';

/**
 * Shared loading / empty / error / list frame for admin registries (IMP-027).
 * Does not fetch — pages own data; this only standardizes chrome.
 */
export function ResourceList({
  loading,
  error,
  empty,
  isEmpty,
  children,
}: {
  readonly loading: boolean;
  readonly error?: string | null;
  readonly empty: string;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="resource-list stack">
      {error !== null && error !== undefined && error !== '' ? (
        <Banner tone="error">{error}</Banner>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && isEmpty ? <Banner tone="info">{empty}</Banner> : null}
      {!loading && !isEmpty ? <ul className="list">{children}</ul> : null}
    </div>
  );
}
