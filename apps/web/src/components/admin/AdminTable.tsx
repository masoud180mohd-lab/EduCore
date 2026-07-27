import type { ReactNode } from 'react';

/**
 * Dense operational table for admin registries (IMP-028).
 * Semantic `<table>` with caption + headers; pages supply body rows.
 * Compose inside ResourceList with variant="table" + Load more footer.
 */
export function AdminTable({
  caption,
  headers,
  children,
}: {
  readonly caption: string;
  readonly headers: ReadonlyArray<string>;
  readonly children: ReactNode;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="admin-table-caption">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header === '' ? '__actions' : header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
