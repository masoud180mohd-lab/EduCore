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
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import {
  type InviteRoleCode,
  type UserRow,
  INVITE_ROLE_CODES,
  userMessage,
} from '@/lib/users/types';

export default function AdminUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleCode, setRoleCode] = useState<InviteRoleCode | ''>('staff');

  async function loadPage(opts: {
    readonly searchQ: string;
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
        filters: { search: opts.searchQ },
      });
      const result = await apiRequest<PaginatedEnvelope<UserRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not load users.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ searchQ: '', cursor: null, append: false });
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
      setInfo('Invitation sent. User appears when membership is active (or search invited).');
      setAppliedSearch(search);
      await loadPage({ searchQ: search, cursor: null, append: false });
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not invite user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title="Users"
        description="Staff directory. Invite by email (membership); edit display name or disable on detail."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onInvite(e)}>
        <h2 className="section-title">Invite staff</h2>
        <div className="field">
          <label htmlFor="email">Email</label>
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
          <label htmlFor="displayName">Display name (optional)</label>
          <input
            id="displayName"
            maxLength={200}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="roleCode">Role</label>
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
          {busy ? 'Inviting…' : 'Send invite'}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
          void loadPage({ searchQ: search, cursor: null, append: false });
        }}
      >
        <div className="field">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={loading || loadingMore}>
          Search
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No users returned."
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ searchQ: appliedSearch, cursor: nextCursor, append: true });
            }}
          />
        }
      >
        <AdminTable caption="Users" headers={['Name', 'Email', 'Status', '']}>
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
