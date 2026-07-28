'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type RoleRow, type UserRoleRow } from '@/lib/roles/types';
import { type OrganizationRow } from '@/lib/organizations/types';
import { type UserRow } from '@/lib/users/types';
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

type ConfirmState =
  | { readonly kind: 'disable' }
  | { readonly kind: 'enable' }
  | { readonly kind: 'membership'; readonly action: LifecycleAction }
  | { readonly kind: 'unassign'; readonly assignmentId: string; readonly roleCode: string }
  | null;

const MEMBERSHIP_COPY: Record<
  LifecycleAction,
  {
    readonly title: string;
    readonly body: string;
    readonly confirmLabel: string;
    readonly done: string;
  }
> = {
  suspend: {
    title: 'Suspend membership?',
    body: 'Suspend this membership? They will lose access to this school until reactivated.',
    confirmLabel: 'Suspend',
    done: 'Membership suspended.',
  },
  reactivate: {
    title: 'Reactivate membership?',
    body: 'Reactivate this membership? They will regain active access to this school.',
    confirmLabel: 'Reactivate',
    done: 'Membership reactivated.',
  },
  remove: {
    title: 'Remove membership?',
    body: 'Remove this membership? Access ends. You can invite them again later (status becomes invited).',
    confirmLabel: 'Remove',
    done: 'Membership removed.',
  },
};

function assignmentKey(roleId: string, organizationId: string | null): string {
  return `${roleId}:${organizationId ?? ''}`;
}

function scopeLabel(organizationId: string | null, orgNames: Record<string, string>): string {
  if (organizationId === null) return 'Entire tenant';
  return orgNames[organizationId] ?? organizationId;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ tenantId: string; userId: string }>();
  const { tenantId, userId } = params;
  const [row, setRow] = useState<UserRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [rolesCatalog, setRolesCatalog] = useState<RoleRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignOrgId, setAssignOrgId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
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
      if (err instanceof ApiClientError) userError = adminFriendlyMessage(err, 'users');
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
        setError(adminFriendlyMessage(err, 'users'));
      } else {
        setError(userError ?? 'Could not load membership.');
      }
    }

    try {
      const [assignments, roles, orgRes] = await Promise.all([
        apiRequest<{ data: UserRoleRow[] }>(
          `/api/v1/user-roles?userId=${encodeURIComponent(userId)}&limit=50`,
          { auth },
        ),
        apiRequest<{ data: RoleRow[] }>('/api/v1/roles?limit=100', { auth }),
        apiRequest<{ data: OrganizationRow[] }>('/api/v1/organizations?limit=100', { auth }),
      ]);
      setUserRoles(assignments.data ?? []);
      setRolesCatalog(roles.data ?? []);
      const orgList = orgRes.data ?? [];
      setOrganizations(orgList);
      const map: Record<string, string> = {};
      for (const org of orgList) map[org.id] = org.name;
      setOrgNames(map);
    } catch {
      setUserRoles([]);
      setRolesCatalog([]);
      setOrganizations([]);
      setOrgNames({});
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
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError('Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  async function runDisable() {
    if (row === null || row.status === 'disabled') return;
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
      setConfirm(null);
      setInfo('User disabled.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError('Could not disable user.');
    } finally {
      setBusy(false);
    }
  }

  async function runEnable() {
    if (row === null || row.status !== 'disabled') return;
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `user.enable:${userId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: UserRow }>(`/api/v1/users/${userId}/enable`, {
        method: 'POST',
        auth,
        body: {},
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('User enabled.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError('Could not enable user.');
    } finally {
      setBusy(false);
    }
  }

  async function runMembershipAction(action: LifecycleAction) {
    if (membership === null) return;
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
      setConfirm(null);
      setInfo(MEMBERSHIP_COPY[action].done);
      if (action === 'reactivate') {
        await load();
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'users'));
      else setError(`Could not ${action} membership.`);
    } finally {
      setBusy(false);
    }
  }

  async function onAssignRole(event: FormEvent) {
    event.preventDefault();
    if (assignRoleId === '') return;
    const auth = readSession();
    if (auth === null) return;
    const organizationId = assignOrgId === '' ? null : assignOrgId;
    if (assignedKeys.has(assignmentKey(assignRoleId, organizationId))) {
      setError('This role is already assigned for that scope.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `user-role.assign:${userId}:${assignRoleId}:${organizationId ?? 'tenant'}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: UserRoleRow }>('/api/v1/user-roles', {
        method: 'POST',
        auth,
        body: {
          userId,
          roleId: assignRoleId,
          ...(organizationId !== null ? { organizationId } : {}),
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setAssignRoleId('');
      setAssignOrgId('');
      setInfo('Role assigned.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not assign role.');
    } finally {
      setBusy(false);
    }
  }

  async function runUnassignRole(assignmentId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `user-role.unassign:${assignmentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<void>(`/api/v1/user-roles/${assignmentId}`, {
        method: 'DELETE',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Role removed.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not remove role.');
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
  const assignedKeys = new Set(userRoles.map((ur) => assignmentKey(ur.roleId, ur.organizationId)));
  const selectedOrgId = assignOrgId === '' ? null : assignOrgId;
  const assignDuplicate =
    assignRoleId !== '' && assignedKeys.has(assignmentKey(assignRoleId, selectedOrgId));

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
              onClick={() => setConfirm({ kind: 'disable' })}
            >
              Disable user
            </button>
          ) : (
            <div className="stack">
              <p className="muted">This user is disabled.</p>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || isSelf}
                onClick={() => setConfirm({ kind: 'enable' })}
              >
                Enable user
              </button>
            </div>
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
                onClick={() => setConfirm({ kind: 'membership', action: 'suspend' })}
              >
                Suspend membership
              </button>
            ) : null}
            {canReactivate ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'membership', action: 'reactivate' })}
              >
                Reactivate membership
              </button>
            ) : null}
            {canRemove ? (
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy || isSelf}
                onClick={() => setConfirm({ kind: 'membership', action: 'remove' })}
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

      {(showUserForm || membership !== null) && rolesCatalog.length > 0 ? (
        <div className="stack" style={{ marginTop: '1.5rem' }}>
          <h2>Roles</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Organization scope is stored on the assignment only; permissions still apply tenant-wide
            until org AuthZ ships.
          </p>
          {userRoles.length === 0 ? (
            <p className="muted">No roles assigned.</p>
          ) : (
            <ul className="list">
              {userRoles.map((ur) => (
                <li
                  key={ur.id}
                  className="card"
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                >
                  <span style={{ flex: 1 }}>
                    <strong>{ur.roleCode}</strong>
                    <div className="muted">
                      Scope: {scopeLabel(ur.organizationId, orgNames)} · Assignment {ur.id}
                    </div>
                  </span>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({ kind: 'unassign', assignmentId: ur.id, roleCode: ur.roleCode })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rolesCatalog.length > 0 ? (
            <form className="stack" onSubmit={(e) => void onAssignRole(e)}>
              <label className="field">
                <span>Assign role</span>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  required
                >
                  <option value="">Select a role…</option>
                  {rolesCatalog.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Scope</span>
                <select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)}>
                  <option value="">Entire tenant</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || assignRoleId === '' || assignDuplicate}
              >
                {busy ? 'Assigning…' : 'Assign role'}
              </button>
            </form>
          ) : (
            <p className="muted">No roles available in this tenant.</p>
          )}
        </div>
      ) : null}

      {!showUserForm && membership === null && error === null ? (
        <p className="muted">Loading…</p>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'disable'
            ? 'Disable user?'
            : confirm?.kind === 'enable'
              ? 'Enable user?'
              : confirm?.kind === 'membership'
                ? MEMBERSHIP_COPY[confirm.action].title
                : confirm?.kind === 'unassign'
                  ? 'Remove role?'
                  : 'Confirm'
        }
        body={
          confirm?.kind === 'disable' && row !== null
            ? `Disable “${row.displayName || row.email}”? They will not be able to sign in.`
            : confirm?.kind === 'enable' && row !== null
              ? `Enable “${row.displayName || row.email}”? They will be able to sign in again.`
              : confirm?.kind === 'membership'
                ? MEMBERSHIP_COPY[confirm.action].body
                : confirm?.kind === 'unassign'
                  ? `Remove role “${confirm.roleCode}” from this user?`
                  : ''
        }
        confirmLabel={
          confirm?.kind === 'disable'
            ? 'Disable'
            : confirm?.kind === 'enable'
              ? 'Enable'
              : confirm?.kind === 'membership'
                ? MEMBERSHIP_COPY[confirm.action].confirmLabel
                : confirm?.kind === 'unassign'
                  ? 'Remove'
                  : 'Confirm'
        }
        danger={
          confirm?.kind === 'disable' ||
          confirm?.kind === 'unassign' ||
          (confirm?.kind === 'membership' && confirm.action !== 'reactivate')
        }
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          if (confirm?.kind === 'disable') void runDisable();
          else if (confirm?.kind === 'enable') void runEnable();
          else if (confirm?.kind === 'membership') void runMembershipAction(confirm.action);
          else if (confirm?.kind === 'unassign') void runUnassignRole(confirm.assignmentId);
        }}
      />
    </AdminShell>
  );
}
