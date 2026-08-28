'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import {
  type AcademicYearRow,
  type LifecycleStatus,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminAcademicYearsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<AcademicYearRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [createStatus, setCreateStatus] = useState<LifecycleStatus>('active');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | LifecycleStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | LifecycleStatus>('');

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly statusQ: '' | LifecycleStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/academic-years', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<AcademicYearRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load academic years.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ searchQ: '', statusQ: '', cursor: null, append: false });
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `academic-year.create:${name}:${code}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { name: name.trim(), status: createStatus };
      if (code.trim() !== '') body['code'] = code.trim();
      if (startsOn !== '') body['startsOn'] = startsOn;
      if (endsOn !== '') body['endsOn'] = endsOn;
      const created = await apiRequest<{ data: AcademicYearRow }>('/api/v1/academic-years', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      setStartsOn('');
      setEndsOn('');
      setCreateStatus('active');
      router.push(`/t/${tenantId}/admin/academic/years/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not create academic year.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← {t('academic.back')}</Link>
      </p>
      <AdminPageHeader title={t('academic.years')} description={t('academic.yearsDesc')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">{t('academic.createYear')}</h2>
        <div className="field">
          <label htmlFor="year-name">{t('common.name')}</label>
          <input
            id="year-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="year-code">{t('common.codeOptional')}</label>
          <input id="year-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="year-starts">{t('common.startsOn')}</label>
          <input
            id="year-starts"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="year-ends">{t('common.endsOn')}</label>
          <input
            id="year-ends"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="year-create-status">{t('common.status')}</label>
          <select
            id="year-create-status"
            value={createStatus}
            onChange={(e) => setCreateStatus(e.target.value as LifecycleStatus)}
          >
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('common.saving') : t('common.create')}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
          setAppliedStatus(statusFilter);
          void loadPage({
            searchQ: search,
            statusQ: statusFilter,
            cursor: null,
            append: false,
          });
        }}
      >
        <div className="field">
          <label htmlFor="year-search">{t('common.search')}</label>
          <input
            id="year-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        <div className="field">
          <label htmlFor="year-list-status">{t('common.status')}</label>
          <select
            id="year-list-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | LifecycleStatus)}
          >
            <option value="">{t('common.allStatuses')}</option>
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading || loadingMore}>
          {t('common.applyFilters')}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty={t('academic.emptyYears')}
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                searchQ: appliedSearch,
                statusQ: appliedStatus,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        <AdminTable
          caption={t('academic.years')}
          headers={[t('common.name'), t('common.code'), t('common.status'), '']}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/academic/years/${row.id}`}>{row.name}</Link>
              </td>
              <td className="muted">{row.code !== null && row.code !== '' ? row.code : '—'}</td>
              <td>
                <StatusChip label={row.status} />
              </td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/academic/years/${row.id}`}
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
