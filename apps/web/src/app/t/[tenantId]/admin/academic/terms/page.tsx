'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

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
import { missingNameIds, resolveYearNames } from '@/lib/admin/resolve-related-names';
import {
  type AcademicYearRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminTermsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<TermRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [yearNames, setYearNames] = useState<Record<string, string>>({});
  const yearNamesRef = useRef(yearNames);
  yearNamesRef.current = yearNames;

  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | LifecycleStatus>('');
  const [appliedYearId, setAppliedYearId] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<'' | LifecycleStatus>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [createStatus, setCreateStatus] = useState<LifecycleStatus>('active');

  async function loadYearPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreYears(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<AcademicYearRow>>(
        buildListQuery('/api/v1/academic-years', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setYears((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setYearsCursor(page.nextCursor);
      setYearNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const y of list) next[y.id] = y.name;
        return next;
      });
    } catch {
      if (!opts.append) {
        setYears([]);
        setYearsCursor(null);
      }
    } finally {
      setLoadingMoreYears(false);
    }
  }

  async function loadPage(opts: {
    readonly yearIdQ: string;
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
      const q = buildListQuery('/api/v1/terms', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          academicYearId: opts.yearIdQ === '' ? undefined : opts.yearIdQ,
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<TermRow>>(q, { auth });
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setRows((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setNextCursor(page.nextCursor);
      setError(null);
      const miss = missingNameIds(
        list.map((r) => r.academicYearId),
        yearNamesRef.current,
      );
      if (miss.length > 0) {
        const names = await resolveYearNames(auth, miss);
        setYearNames((prev) => ({ ...prev, ...names }));
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load terms.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadYearPicker({ cursor: null, append: false });
    void loadPage({
      yearIdQ: '',
      searchQ: '',
      statusQ: '',
      cursor: null,
      append: false,
    });
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || academicYearId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `term.create:${academicYearId}:${name}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        academicYearId,
        name: name.trim(),
        status: createStatus,
      };
      if (code.trim() !== '') body['code'] = code.trim();
      if (startsOn !== '') body['startsOn'] = startsOn;
      if (endsOn !== '') body['endsOn'] = endsOn;
      const created = await apiRequest<{ data: TermRow }>('/api/v1/terms', {
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
      router.push(`/t/${tenantId}/admin/academic/terms/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not create term.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← Academic</Link>
      </p>
      <AdminPageHeader
        title="Terms"
        description="Terms belong to an academic year. Search and filter the list below."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">Create term</h2>
        <div className="field">
          <label htmlFor="term-year">Academic year</label>
          <select
            id="term-year"
            required
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={yearsCursor}
            loadingMore={loadingMoreYears}
            onLoadMore={() => {
              void loadYearPicker({ cursor: yearsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="term-name">Name</label>
          <input
            id="term-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="term-code">Code (optional)</label>
          <input id="term-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="term-starts">Starts on (optional)</label>
          <input
            id="term-starts"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="term-ends">Ends on (optional)</label>
          <input
            id="term-ends"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="term-create-status">Status</label>
          <select
            id="term-create-status"
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
        <button type="submit" className="btn btn-primary" disabled={busy || academicYearId === ''}>
          {busy ? 'Saving…' : 'Create term'}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedYearId(yearFilter);
          setAppliedSearch(search);
          setAppliedStatus(statusFilter);
          void loadPage({
            yearIdQ: yearFilter,
            searchQ: search,
            statusQ: statusFilter,
            cursor: null,
            append: false,
          });
        }}
      >
        <div className="field">
          <label htmlFor="term-filter-year">Academic year</label>
          <select
            id="term-filter-year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={yearsCursor}
            loadingMore={loadingMoreYears}
            onLoadMore={() => {
              void loadYearPicker({ cursor: yearsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="term-search">Search</label>
          <input
            id="term-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        <div className="field">
          <label htmlFor="term-list-status">Status</label>
          <select
            id="term-list-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | LifecycleStatus)}
          >
            <option value="">All statuses</option>
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading || loadingMore}>
          Apply filters
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No terms yet."
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                yearIdQ: appliedYearId,
                searchQ: appliedSearch,
                statusQ: appliedStatus,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        <AdminTable caption="Terms" headers={['Name', 'Year', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/academic/terms/${row.id}`}>{row.name}</Link>
              </td>
              <td className="muted">{yearNames[row.academicYearId] ?? row.academicYearId}</td>
              <td>
                <StatusChip label={row.status} />
              </td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/academic/terms/${row.id}`}
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
