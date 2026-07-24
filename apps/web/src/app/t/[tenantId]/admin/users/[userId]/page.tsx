'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type UserRow, userMessage } from '@/lib/users/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminUserDetailPage() {
  const params = useParams<{ tenantId: string; userId: string }>();
  const { tenantId, userId } = params;
  const [row, setRow] = useState<UserRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: UserRow }>(`/api/v1/users/${userId}`, { auth });
      setRow(result.data);
      setDisplayName(result.data.displayName ?? '');
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not load user.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `user.patch:${userId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: UserRow }>(`/api/v1/users/${userId}`, {
        method: 'PATCH',
        auth,
        body: { displayName: displayName.trim() },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('User updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    if (row === null || row.status === 'disabled') return;
    if (
      !window.confirm(
        `Disable “${row.displayName || row.email}”? They will not be able to sign in.`,
      )
    )
      return;
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `user.disable:${userId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: UserRow }>(`/api/v1/users/${userId}/disable`, {
        method: 'POST',
        auth,
        body: {},
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('User disabled.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError('Could not disable user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/users`}>← Users</Link>
      </p>
      <h1>{row?.displayName || row?.email || 'User'}</h1>
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
      {row !== null ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <div className="muted">
              Email: {row.email} · Status: {row.status} · Id: {row.id}
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
          {row.status !== 'disabled' ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => void onDisable()}
            >
              Disable user
            </button>
          ) : (
            <p className="muted">This user is disabled.</p>
          )}
          <p className="muted">
            Access is granted by membership invite (list page). Membership suspend/remove is not in
            this UI yet.
          </p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
