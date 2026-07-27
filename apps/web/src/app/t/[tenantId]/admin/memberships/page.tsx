'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type MembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';

type MembershipRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: string;
  readonly joinedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const STATUS_FILTERS: ReadonlyArray<{ value: '' | MembershipStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'removed', label: 'Removed' },
];

function membershipMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  return teacherFriendlyMessage(err);
}

export default function AdminMembershipsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | MembershipStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | MembershipStatus>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadPage(opts: {
    readonly statusFilter: '' | MembershipStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/memberships', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: { status: opts.statusFilter === '' ? undefined : opts.statusFilter },
      });
      const result = await apiRequest<PaginatedEnvelope<MembershipRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(membershipMessage(err));
      else setError('Could not load memberships.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ statusFilter: '', cursor: null, append: false });
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    setAppliedStatus(status);
    void loadPage({ statusFilter: status, cursor: null, append: false });
  }

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title="Memberships"
        description="Tenant roster by membership status. Open a user to suspend, reactivate, or remove."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack" onSubmit={onFilter} style={{ marginBottom: '1rem' }}>
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | MembershipStatus)}
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary" type="submit" disabled={loading || loadingMore}>
          Apply filter
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No memberships for this filter."
        isEmpty={rows.length === 0}
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                statusFilter: appliedStatus,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        {rows.map((m) => (
          <li key={m.id}>
            <Link className="card" href={`/t/${tenantId}/admin/users/${m.userId}`}>
              <strong>
                <StatusChip label={m.status} />
              </strong>
              <div className="muted">
                User {m.userId}
                {m.joinedAt !== null ? ` · Joined ${m.joinedAt}` : null}
              </div>
              <div className="muted">Membership {m.id}</div>
            </Link>
          </li>
        ))}
      </ResourceList>
    </AdminShell>
  );
}
