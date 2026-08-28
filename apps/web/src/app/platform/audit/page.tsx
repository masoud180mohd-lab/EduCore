'use client';

import { type FormEvent, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  ResourceList,
  ResourceListPagination,
} from '@/components/admin';
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
import type { PlatformAuditRow } from '@/lib/platform/types';

export default function PlatformAuditPage() {
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<PlatformAuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [action, setAction] = useState('');
  const [appliedTenantId, setAppliedTenantId] = useState('');
  const [appliedAction, setAppliedAction] = useState('');

  async function loadPage(opts: {
    readonly tenantQ: string;
    readonly actionQ: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/platform/audit', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          tenantId: opts.tenantQ,
          action: opts.actionQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<PlatformAuditRow>>(q, {
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
      else setError(t('platform.auditError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ tenantQ: '', actionQ: '', cursor: null, append: false });
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    setAppliedTenantId(tenantId);
    setAppliedAction(action);
    void loadPage({ tenantQ: tenantId, actionQ: action, cursor: null, append: false });
  }

  return (
    <div className="stack">
      <AdminPageHeader
        title={t('platform.auditTitle')}
        description={t('platform.auditDescription')}
      />
      <form className="filters" onSubmit={onFilter}>
        <label>
          {t('platform.tenant')}
          <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
        </label>
        <label>
          {t('platform.action')}
          <input value={action} onChange={(event) => setAction(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary">
          {t('common.submit')}
        </button>
      </form>
      <ResourceList
        loading={loading}
        error={error}
        empty={t('platform.emptyAudit')}
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                tenantQ: appliedTenantId,
                actionQ: appliedAction,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        <AdminTable
          caption={t('platform.auditTitle')}
          headers={[
            t('platform.time'),
            t('platform.action'),
            t('platform.outcome'),
            t('platform.actor'),
            t('platform.tenant'),
            t('platform.resource'),
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.occurredAt).toLocaleString()}</td>
              <td>{row.action}</td>
              <td>{row.outcome}</td>
              <td>{row.actorUserId ?? '—'}</td>
              <td>{row.tenantId ?? '—'}</td>
              <td>
                {row.resourceType ?? '—'}
                {row.resourceId !== null ? ` ${row.resourceId}` : ''}
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </div>
  );
}
