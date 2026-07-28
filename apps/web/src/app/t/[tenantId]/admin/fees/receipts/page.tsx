'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { readSession } from '@/lib/auth/session';

type ReceiptRow = {
  readonly id: string;
  readonly paymentAttemptId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly issuedAt: string;
};

export default function AdminReceiptsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadPage(opts: { readonly cursor: string | null; readonly append: boolean }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/receipts', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
      });
      const result = await apiRequest<PaginatedEnvelope<ReceiptRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load receipts.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ cursor: null, append: false });
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees`}>← Fees</Link>
      </p>
      <AdminPageHeader
        title="Receipts"
        description="Issued after succeeded office payments (ACF-012)."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <ResourceList
        loading={loading}
        empty="No receipts yet."
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ cursor: nextCursor, append: true });
            }}
          />
        }
      >
        <AdminTable caption="Receipts" headers={['Receipt #', 'Status', 'Issued', '']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/fees/receipts/${r.id}`}>{r.receiptNumber}</Link>
              </td>
              <td>
                <StatusChip label={r.status} />
              </td>
              <td className="muted">{new Date(r.issuedAt).toLocaleString()}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/fees/receipts/${r.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
