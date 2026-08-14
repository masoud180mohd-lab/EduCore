'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { resolveUserNames } from '@/lib/admin/resolve-related-names';
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

const MEMBERSHIP_STATUSES: ReadonlyArray<MembershipStatus> = [
  'active',
  'invited',
  'suspended',
  'removed',
];

export default function AdminMembershipsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'' | MembershipStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | MembershipStatus>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

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
      const list = result.data ?? [];
      setRows((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setNextCursor(page.nextCursor);
      setError(null);
      const names = await resolveUserNames(
        auth,
        list.map((m) => m.userId),
      );
      setUserNames((prev) => (opts.append ? { ...prev, ...names } : { ...names }));
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'memberships'));
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
        title={t('memberships.title')}
        description={t('memberships.description')}
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack" onSubmit={onFilter} style={{ marginBottom: '1rem' }}>
        <label className="field">
          <span>{t('common.status')}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | MembershipStatus)}
          >
            <option value="">{t('common.allStatuses')}</option>
            {MEMBERSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary" type="submit" disabled={loading || loadingMore}>
          {t('common.applyFilters')}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty={t('memberships.empty')}
        isEmpty={rows.length === 0}
        variant="table"
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
        <AdminTable
          caption={t('memberships.title')}
          headers={[t('common.status'), t('users.user'), 'Joined', '']}
        >
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <StatusChip label={m.status} />
              </td>
              <td>
                <Link href={`/t/${tenantId}/admin/users/${m.userId}`}>
                  {userNames[m.userId] ?? m.userId}
                </Link>
              </td>
              <td className="muted">{m.joinedAt ?? '—'}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/users/${m.userId}`}
                >
                  {t('common.open')}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
