import type { ReactNode } from 'react';

export type BannerTone = 'error' | 'info' | 'warn';

/**
 * Shared admin/teacher banner (DSF-001 language / IMP-027).
 * Prefer this over hand-rolled `div.banner` markup.
 */
export function Banner({
  tone,
  children,
  role,
}: {
  readonly tone: BannerTone;
  readonly children: ReactNode;
  /** Defaults to `alert` for error/warn, undefined for info. */
  readonly role?: 'alert' | 'status';
}) {
  const resolvedRole = role ?? (tone === 'info' ? 'status' : 'alert');
  return (
    <div className={`banner banner-${tone}`} role={resolvedRole}>
      {children}
    </div>
  );
}
