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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={t('memberships.title')}
          description={t('memberships.description')}
        />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardContent className="pt-6">
            <form className="flex flex-wrap items-end gap-3" onSubmit={onFilter}>
              <div className="flex flex-col gap-2 min-w-[180px]">
                <Label htmlFor="status">{t('common.status')}</Label>
                <select
                  id="status"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
              </div>
              <Button variant="secondary" type="submit" disabled={loading || loadingMore}>
                {t('common.applyFilters')}
              </Button>
            </form>
          </CardContent>
        </Card>

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
                <td className="font-medium">
                  <Link
                    href={`/t/${tenantId}/admin/users/${m.userId}`}
                    className="hover:underline text-primary"
                  >
                    {userNames[m.userId] ?? m.userId}
                  </Link>
                </td>
                <td className="text-muted-foreground">{m.joinedAt ?? '—'}</td>
                <td className="admin-table-actions">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/t/${tenantId}/admin/users/${m.userId}`}>
                      {t('common.open')}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </ResourceList>
      </div>
    </AdminShell>
  );
}
