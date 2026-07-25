'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type UserRow, userMessage } from '@/lib/users/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type MembershipRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: string;
  readonly joinedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type LifecycleAction = 'suspend' | 'reactivate' | 'remove';

export default function AdminUserDetailPage() {
  const params = useParams<{ tenantId: string; userId: string }>();
  const { tenantId, userId } = params;
  const [row, setRow] = useState<UserRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;

    try {
      const me = await apiRequest<{ data: { user: { id: string } } }>('/api/v1/auth/me', { auth });
      setSessionUserId(me.data.user.id);
    } catch {
      setSessionUserId(null);
    }

    let userError: string | null = null;
    let loadedUser: UserRow | null = null;
    try {
      const result = await apiRequest<{ data: UserRow }>(`/api/v1/users/${userId}`, { auth });
      loadedUser = result.data;
      setRow(result.data);
      setDisplayName(result.data.displayName ?? '');
    } catch (err) {
      if (err instanceof ApiClientError) userError = userMessage(err);
      else userError = 'Could not load user.';
      setRow(null);
      setDisplayName('');
    }

    try {
      const list = await apiRequest<{ data: MembershipRow[] }>(
        `/api/v1/memberships?userId=${encodeURIComponent(userId)}&limit=5`,
        { auth },
      );
      const first = list.data[0] ?? null;
      setMembership(first);
      if (loadedUser !== null) {
        setError(null);
      } else if (first !== null) {
        // Suspended/removed members may 404 on GET /users (active roster only).
        setError(null);
      } else if (userError !== null) {
        setError(userError);
      } else {
        setError('User not found.');
      }
    } catch (err) {
      if (loadedUser !== null) {
        setMembership(null);
        setError(null);
      } else if (err instanceof ApiClientError) {
        setError(userMessage(err));
      } else {
        setError(userError ?? 'Could not load membership.');
      }
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

  async function onMembershipAction(action: LifecycleAction) {
    if (membership === null) return;
    const labels: Record<LifecycleAction, { confirm: string; done: string }> = {
      suspend: {
        confirm: 'Suspend this membership? They will lose access to this school until reactivated.',
        done: 'Membership suspended.',
      },
      reactivate: {
        confirm: 'Reactivate this membership? They will regain active access to this school.',
        done: 'Membership reactivated.',
      },
      remove: {
        confirm:
          'Remove this membership? Access ends. You can invite them again later (status becomes invited).',
        done: 'Membership removed.',
      },
    };
    if (!window.confirm(labels[action].confirm)) return;

    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `membership.${action}:${membership.id}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: MembershipRow }>(
        `/api/v1/memberships/${membership.id}/${action}`,
        {
          method: 'POST',
          auth,
          body: {},
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      setMembership(result.data);
      setInfo(labels[action].done);
      if (action === 'reactivate') {
        await load();
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(userMessage(err));
      else setError(`Could not ${action} membership.`);
    } finally {
      setBusy(false);
    }
  }

  const isSelf = sessionUserId !== null && sessionUserId.toLowerCase() === userId.toLowerCase();
  const status = membership?.status;
  const canSuspend = status === 'active' || status === 'invited';
  const canReactivate = status === 'suspended';
  const canRemove = status !== undefined && status !== 'removed';
  const showUserForm = row !== null;

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
      {showUserForm ? (
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
        </div>
      ) : null}

      {membership !== null ? (
        <div className="stack" style={{ marginTop: '1.5rem' }}>
          <h2>Membership</h2>
          <p className="muted">
            Status: <strong>{membership.status}</strong> · Id: {membership.id}
            {membership.joinedAt !== null ? ` · Joined: ${membership.joinedAt}` : null}
          </p>
          {isSelf ? (
            <p className="muted">You cannot suspend or remove your own membership.</p>
          ) : null}
          <div className="stack" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '0.5rem' }}>
            {canSuspend ? (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy || isSelf}
                onClick={() => void onMembershipAction('suspend')}
              >
                Suspend membership
              </button>
            ) : null}
            {canReactivate ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => void onMembershipAction('reactivate')}
              >
                Reactivate membership
              </button>
            ) : null}
            {canRemove ? (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy || isSelf}
                onClick={() => void onMembershipAction('remove')}
              >
                Remove membership
              </button>
            ) : null}
            {status === 'removed' ? (
              <p className="muted">Membership is removed. Invite again from the Users list.</p>
            ) : null}
          </div>
        </div>
      ) : showUserForm && error === null ? (
        <p className="muted" style={{ marginTop: '1.5rem' }}>
          No membership found for this user in this school.
        </p>
      ) : null}

      {!showUserForm && membership === null && error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
