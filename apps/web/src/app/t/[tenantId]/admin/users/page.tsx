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
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import {
  type InviteRoleCode,
  type UserRow,
  type UserStatus,
  INVITE_ROLE_CODES,
  USER_STATUSES,
} from '@/lib/users/types';

export default function AdminUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | UserStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | UserStatus>('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleCode, setRoleCode] = useState<InviteRoleCode | ''>('staff');

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly statusQ: '' | UserStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/users', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<UserRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError(t('users.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ searchQ: '', statusQ: '', cursor: null, append: false });
  }, []);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `membership.invite:${email}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: {
        email: string;
        displayName?: string;
        roleCodes?: InviteRoleCode[];
      } = { email: email.trim().toLowerCase() };
      if (displayName.trim() !== '') body.displayName = displayName.trim();
      if (roleCode !== '') body.roleCodes = [roleCode];
      await apiRequest('/api/v1/memberships', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setEmail('');
      setDisplayName('');
      setRoleCode('staff');
      setInfo(t('users.invited'));
      setAppliedSearch(search);
      setAppliedStatus(statusFilter);
      await loadPage({
        searchQ: search,
        statusQ: statusFilter,
        cursor: null,
        append: false,
      });
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError(t('users.inviteError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader title={t('users.title')} description={t('users.description')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onInvite(e)}>
        <h2 className="section-title">{t('users.invite')}</h2>
        <div className="field">
          <label htmlFor="email">{t('common.email')}</label>
          <input
            id="email"
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="displayName">{t('common.displayNameOptional')}</label>
          <input
            id="displayName"
            maxLength={200}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="roleCode">{t('users.role')}</label>
          <select
            id="roleCode"
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value as InviteRoleCode | '')}
          >
            <option value="">None</option>
            {INVITE_ROLE_CODES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || email.trim() === ''}>
          {busy ? t('common.saving') : t('common.invite')}
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
          <label htmlFor="search">{t('common.search')}</label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </div>
        <div className="field">
          <label htmlFor="list-status">{t('common.status')}</label>
          <select
            id="list-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | UserStatus)}
          >
            <option value="">{t('common.allStatuses')}</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit" disabled={loading || loadingMore}>
          {t('common.applyFilters')}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty={t('users.empty')}
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
          caption={t('users.title')}
          headers={[t('common.name'), t('common.email'), t('common.status'), '']}
        >
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/users/${u.id}`}>{u.displayName || u.email}</Link>
              </td>
              <td className="muted">{u.email}</td>
              <td>{u.status !== undefined ? <StatusChip label={u.status} /> : '—'}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/users/${u.id}`}
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
