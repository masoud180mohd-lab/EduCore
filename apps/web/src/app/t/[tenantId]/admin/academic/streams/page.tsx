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
import { missingNameIds, resolveClassNames } from '@/lib/admin/resolve-related-names';
import {
  type ClassRow,
  type LifecycleStatus,
  type StreamRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStreamsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const classNamesRef = useRef(classNames);
  classNamesRef.current = classNames;

  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | LifecycleStatus>('');
  const [appliedClassId, setAppliedClassId] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<'' | LifecycleStatus>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classId, setClassId] = useState('');
  const [createStatus, setCreateStatus] = useState<LifecycleStatus>('active');

  async function loadClassPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreClasses(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<ClassRow>>(
        buildListQuery('/api/v1/classes', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setClasses((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setClassesCursor(page.nextCursor);
      setClassNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const c of list) next[c.id] = c.name;
        return next;
      });
    } catch {
      if (!opts.append) {
        setClasses([]);
        setClassesCursor(null);
      }
    } finally {
      setLoadingMoreClasses(false);
    }
  }

  async function loadPage(opts: {
    readonly classIdQ: string;
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
      const q = buildListQuery('/api/v1/streams', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          classId: opts.classIdQ === '' ? undefined : opts.classIdQ,
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<StreamRow>>(q, { auth });
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setRows((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setNextCursor(page.nextCursor);
      setError(null);
      const miss = missingNameIds(
        list.map((r) => r.classId),
        classNamesRef.current,
      );
      if (miss.length > 0) {
        const names = await resolveClassNames(auth, miss);
        setClassNames((prev) => ({ ...prev, ...names }));
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load streams.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadClassPicker({ cursor: null, append: false });
    void loadPage({
      classIdQ: '',
      searchQ: '',
      statusQ: '',
      cursor: null,
      append: false,
    });
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || classId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `stream.create:${classId}:${name}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        classId,
        name: name.trim(),
        status: createStatus,
      };
      if (code.trim() !== '') body['code'] = code.trim();
      const created = await apiRequest<{ data: StreamRow }>('/api/v1/streams', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      setCreateStatus('active');
      router.push(`/t/${tenantId}/admin/academic/streams/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not create stream.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← {t('academic.back')}</Link>
      </p>
      <AdminPageHeader title={t('academic.streams')} description={t('academic.streamsDesc')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">{t('academic.createStream')}</h2>
        <div className="field">
          <label htmlFor="stream-class">{t('common.class')}</label>
          <select
            id="stream-class"
            required
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">{t('common.select')} {t('common.class')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={classesCursor}
            loadingMore={loadingMoreClasses}
            onLoadMore={() => {
              void loadClassPicker({ cursor: classesCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="stream-name">{t('common.name')}</label>
          <input
            id="stream-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="stream-code">{t('common.codeOptional')}</label>
          <input id="stream-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stream-create-status">{t('common.status')}</label>
          <select
            id="stream-create-status"
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
        <button type="submit" className="btn btn-primary" disabled={busy || classId === ''}>
          {busy ? t('common.saving') : t('common.create')}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedClassId(classFilter);
          setAppliedSearch(search);
          setAppliedStatus(statusFilter);
          void loadPage({
            classIdQ: classFilter,
            searchQ: search,
            statusQ: statusFilter,
            cursor: null,
            append: false,
          });
        }}
      >
        <div className="field">
          <label htmlFor="stream-filter-class">{t('common.class')}</label>
          <select
            id="stream-filter-class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">{t('common.allClasses')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={classesCursor}
            loadingMore={loadingMoreClasses}
            onLoadMore={() => {
              void loadClassPicker({ cursor: classesCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="stream-search">{t('common.search')}</label>
          <input
            id="stream-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        <div className="field">
          <label htmlFor="stream-list-status">{t('common.status')}</label>
          <select
            id="stream-list-status"
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
        empty={t('academic.emptyStreams')}
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                classIdQ: appliedClassId,
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
          caption={t('academic.streams')}
          headers={[t('common.name'), t('common.class'), t('common.status'), '']}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/academic/streams/${row.id}`}>{row.name}</Link>
              </td>
              <td className="muted">{classNames[row.classId] ?? row.classId}</td>
              <td>
                <StatusChip label={row.status} />
              </td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/academic/streams/${row.id}`}
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
