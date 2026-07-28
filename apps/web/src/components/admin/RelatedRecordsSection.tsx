import type { ReactNode } from 'react';

import Link from 'next/link';

import { Banner } from '@/components/admin/Banner';

/**
 * Card section for related records on detail pages (IMP-031).
 * Per-section loading/error — does not block sibling sections.
 */
export function RelatedRecordsSection({
  title,
  loading,
  error,
  emptyMessage,
  isEmpty,
  createHref,
  createLabel,
  children,
  footer,
}: {
  readonly title: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly emptyMessage: string;
  readonly isEmpty: boolean;
  readonly createHref?: string;
  readonly createLabel?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  return (
    <section className="card stack related-records-section">
      <div className="related-records-section__header">
        <h2 className="section-title">{title}</h2>
        {createHref !== undefined && createLabel !== undefined ? (
          <Link className="btn btn-secondary" href={createHref}>
            {createLabel}
          </Link>
        ) : null}
      </div>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && isEmpty && error === null ? <Banner tone="info">{emptyMessage}</Banner> : null}
      {!loading && !isEmpty && error === null ? children : null}
      {!loading && !isEmpty && error === null && footer !== undefined ? footer : null}
    </section>
  );
}
