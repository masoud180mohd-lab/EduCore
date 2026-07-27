import type { ReactNode } from 'react';

/**
 * Standard admin page title + short description (IMP-027).
 */
export function AdminPageHeader({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <h1>{title}</h1>
      {description !== undefined && description !== '' ? (
        <p className="muted">{description}</p>
      ) : null}
      {children}
    </header>
  );
}
