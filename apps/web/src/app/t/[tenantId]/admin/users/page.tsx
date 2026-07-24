'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type InviteRoleCode,
  type UserRow,
  INVITE_ROLE_CODES,
  userMessage,
} from '@/lib/users/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleCode, setRoleCode] = useState<InviteRoleCode | ''>('staff');

  async function load(searchQ: string) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const q =
        searchQ.trim() !== ''
          ? `/api/v1/users?limit=50&search=${encodeURIComponent(searchQ.trim())}`
          : '/api/v1/users?limit=50';
      const result = await apiRequest<{ data: UserRow[] }>(q, { auth });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
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
      await load(search);
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not invite user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Users</h1>
      <p className="muted">
        Staff directory. Invite by email (membership); edit display name or disable on detail.
      </p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {info !== null ? (
        <div className="banner banner-info" role="status">
          {info}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onInvite(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Invite staff</h2>
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
          void load(search);
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
        <button className="btn btn-secondary" type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No users returned.</div>
      ) : null}
      <ul className="list">
        {rows.map((u) => (
          <li key={u.id} className="card">
            <Link href={`/t/${tenantId}/admin/users/${u.id}`}>
              <strong>{u.displayName || u.email}</strong>
            </Link>
            <div className="muted">
              {u.email}
              {u.status !== undefined ? ` · ${u.status}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
