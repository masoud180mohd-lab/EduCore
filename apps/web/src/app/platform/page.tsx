'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminTable, ResourceList, ResourceListPagination, StatusChip } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import {
  PLATFORM_TENANT_STATUSES,
  type PlatformTenantListRow,
  type PlatformTenantStatus,
} from '@/lib/platform/types';

function statusTone(status: string): 'ok' | 'muted' | 'neutral' {
  if (status === 'active') return 'ok';
  if (status === 'draft' || status === 'suspended' || status === 'closed') return 'muted';
  return 'neutral';
}

export default function PlatformSchoolsPage() {
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<PlatformTenantListRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'' | PlatformTenantStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | PlatformTenantStatus>('');

  async function loadPage(opts: {
    readonly statusQ: '' | PlatformTenantStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/platform/tenants', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: { status: opts.statusQ === '' ? undefined : opts.statusQ },
      });
      const result = await apiRequest<PaginatedEnvelope<PlatformTenantListRow>>(q, {
        auth,
        requireTenant: false,
      });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) setError(t('platform.forbidden'));
      else setError(t('platform.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ statusQ: '', cursor: null, append: false });
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    setAppliedStatus(statusFilter);
    void loadPage({ statusQ: statusFilter, cursor: null, append: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {t('platform.schoolsTitle')}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t('platform.schoolsDescription')}
          </p>
        </div>
        <Link
          className="inline-flex h-10 min-h-11 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
          href="/platform/tenants/new"
        >
          {t('platform.register')}
        </Link>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
        onSubmit={onFilter}
      >
        <label>
          {t('platform.filterStatus')}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | PlatformTenantStatus)}
          >
            <option value="">{t('platform.allStatuses')}</option>
            {PLATFORM_TENANT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          {t('common.submit')}
        </button>
      </form>
      <ResourceList
        loading={loading}
        error={error}
        empty={t('platform.emptySchools')}
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ statusQ: appliedStatus, cursor: nextCursor, append: true });
            }}
          />
        }
      >
        <AdminTable
          caption={t('platform.schoolsTitle')}
          headers={[
            t('platform.name'),
            t('platform.code'),
            t('platform.status'),
            t('platform.plan'),
            t('common.created'),
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/platform/tenants/${row.id}`}>{row.name}</Link>
              </td>
              <td>{row.code}</td>
              <td>
                <StatusChip label={row.status} tone={statusTone(row.status)} />
              </td>
              <td>{row.planCode ?? '—'}</td>
              <td>{new Date(row.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </div>
  );
}
