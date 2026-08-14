'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  Banner,
  ConfirmDialog,
  ResourceListPagination,
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
import { type RoleRow, type UserRoleRow } from '@/lib/roles/types';
import { type OrganizationRow } from '@/lib/organizations/types';
import { type UserRow } from '@/lib/users/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import type { MessageKey } from '@/lib/i18n/messages';

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
    readonly title: MessageKey;
    readonly body: MessageKey;
    readonly confirmLabel: MessageKey;
    readonly done: MessageKey;
  }
> = {
  suspend: {
    title: 'users.suspendTitle',
    body: 'users.suspendBody',
    confirmLabel: 'users.suspend',
    done: 'users.suspendDone',
  },
  reactivate: {
    title: 'users.reactivateTitle',
    body: 'users.reactivateBody',
    confirmLabel: 'users.reactivate',
    done: 'users.reactivateDone',
  },
  remove: {
    title: 'users.removeTitle',
    body: 'users.removeBody',
    confirmLabel: 'common.remove',
    done: 'users.removeDone',
  },
};

function assignmentKey(roleId: string, organizationId: string | null): string {
  return `${roleId}:${organizationId ?? ''}`;
}

function scopeLabel(
  organizationId: string | null,
  orgNames: Record<string, string>,
  entireTenant: string,
): string {
  if (organizationId === null) return entireTenant;
  return orgNames[organizationId] ?? organizationId;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ tenantId: string; userId: string }>();
  const { tenantId, userId } = params;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<UserRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [rolesCatalog, setRolesCatalog] = useState<RoleRow[]>([]);
  const [rolesCursor, setRolesCursor] = useState<string | null>(null);
  const [loadingMoreRoles, setLoadingMoreRoles] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [orgsCursor, setOrgsCursor] = useState<string | null>(null);
  const [loadingMoreOrgs, setLoadingMoreOrgs] = useState(false);
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
      const assignments = await apiRequest<{ data: UserRoleRow[] }>(
        `/api/v1/user-roles?userId=${encodeURIComponent(userId)}&limit=50`,
        { auth },
      );
      setUserRoles(assignments.data ?? []);
    } catch {
      setUserRoles([]);
    }

    try {
      const roles = await apiRequest<PaginatedEnvelope<RoleRow>>(
        buildListQuery('/api/v1/roles', { limit: ADMIN_LIST_DEFAULT_LIMIT }),
        { auth },
      );
      const page = readPageMeta(roles);
      setRolesCatalog([...(roles.data ?? [])]);
      setRolesCursor(page.nextCursor);
    } catch {
      setRolesCatalog([]);
      setRolesCursor(null);
    }

    try {
      const orgRes = await apiRequest<PaginatedEnvelope<OrganizationRow>>(
        buildListQuery('/api/v1/organizations', { limit: ADMIN_LIST_DEFAULT_LIMIT }),
        { auth },
      );
      const page = readPageMeta(orgRes);
      const orgList = orgRes.data ?? [];
      setOrganizations([...orgList]);
      setOrgsCursor(page.nextCursor);
      const map: Record<string, string> = {};
      for (const org of orgList) map[org.id] = org.name;
      setOrgNames(map);
    } catch {
      setOrganizations([]);
      setOrgsCursor(null);
      setOrgNames({});
    }
  }, [userId]);

  async function loadMoreRoles() {
    const auth = readSession();
    if (auth === null || rolesCursor === null) return;
    setLoadingMoreRoles(true);
    try {
      const roles = await apiRequest<PaginatedEnvelope<RoleRow>>(
        buildListQuery('/api/v1/roles', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: rolesCursor,
        }),
        { auth },
      );
      const page = readPageMeta(roles);
      setRolesCatalog((prev) => appendById(prev, roles.data ?? []));
      setRolesCursor(page.nextCursor);
    } finally {
      setLoadingMoreRoles(false);
    }
  }

  async function loadMoreOrgs() {
    const auth = readSession();
    if (auth === null || orgsCursor === null) return;
    setLoadingMoreOrgs(true);
    try {
      const orgRes = await apiRequest<PaginatedEnvelope<OrganizationRow>>(
        buildListQuery('/api/v1/organizations', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: orgsCursor,
        }),
        { auth },
      );
      const page = readPageMeta(orgRes);
      const list = orgRes.data ?? [];
      setOrganizations((prev) => appendById(prev, list));
      setOrgsCursor(page.nextCursor);
      setOrgNames((prev) => {
        const next = { ...prev };
        for (const org of list) next[org.id] = org.name;
        return next;
      });
    } finally {
      setLoadingMoreOrgs(false);
    }
  }

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
      setInfo(t(MEMBERSHIP_COPY[action].done));
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
        <Link href={`/t/${tenantId}/admin/users`}>← {t('users.title')}</Link>
      </p>
      <AdminPageHeader title={row?.displayName || row?.email || t('users.user')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {showUserForm ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>{t('common.displayName')}</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <div className="muted">
              {t('common.email')}: {row.email} · {t('common.status')}: {row.status}
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </form>
          {row.status !== 'disabled' ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => setConfirm({ kind: 'disable' })}
            >
              {t('users.disableUser')}
            </button>
          ) : (
            <div className="stack">
              <p className="muted">{t('users.disabledHint')}</p>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || isSelf}
                onClick={() => setConfirm({ kind: 'enable' })}
              >
                {t('users.enableUser')}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {membership !== null ? (
        <div className="stack" style={{ marginTop: '1.5rem' }}>
          <h2>{t('memberships.title')}</h2>
          <p className="muted">
            {t('common.status')}: <strong>{membership.status}</strong>
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
          <h2>{t('roles.title')}</h2>
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
                      {t('users.scope')}: {scopeLabel(ur.organizationId, orgNames, t('users.entireTenant'))} · {t('users.assignment', { id: ur.id })}
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
                    {t('common.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rolesCatalog.length > 0 || rolesCursor !== null ? (
            <form className="stack" onSubmit={(e) => void onAssignRole(e)}>
              <label className="field">
                <span>{t('users.assignRole')}</span>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  required
                >
                  <option value="">{t('common.selectRole')}</option>
                  {rolesCatalog.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
                <ResourceListPagination
                  nextCursor={rolesCursor}
                  loadingMore={loadingMoreRoles}
                  onLoadMore={() => {
                    void loadMoreRoles();
                  }}
                />
              </label>
              <label className="field">
                <span>{t('common.scope')}</span>
                <select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)}>
                  <option value="">{t('users.entireTenant')}</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <ResourceListPagination
                  nextCursor={orgsCursor}
                  loadingMore={loadingMoreOrgs}
                  onLoadMore={() => {
                    void loadMoreOrgs();
                  }}
                />
              </label>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || assignRoleId === '' || assignDuplicate}
              >
                {busy ? t('common.assigning') : t('users.assignRole')}
              </button>
            </form>
          ) : (
            <p className="muted">{t('users.noRoles')}</p>
          )}
        </div>
      ) : null}

      {!showUserForm && membership === null && error === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === 'disable'
            ? t('users.disableConfirm')
            : confirm?.kind === 'enable'
              ? t('users.enableConfirm')
              : confirm?.kind === 'membership'
                ? t(MEMBERSHIP_COPY[confirm.action].title)
                : confirm?.kind === 'unassign'
                  ? t('users.removeRole')
                  : t('common.confirm')
        }
        body={
          confirm?.kind === 'disable' && row !== null
            ? t('users.disableBody', { name: row.displayName || row.email })
            : confirm?.kind === 'enable' && row !== null
              ? t('users.enableBody', { name: row.displayName || row.email })
              : confirm?.kind === 'membership'
                ? t(MEMBERSHIP_COPY[confirm.action].body)
                : confirm?.kind === 'unassign'
                  ? t('users.removeRoleBody', { code: confirm.roleCode })
                  : ''
        }
        confirmLabel={
          confirm?.kind === 'disable'
            ? t('common.disable')
            : confirm?.kind === 'enable'
              ? t('common.enable')
              : confirm?.kind === 'membership'
                ? t(MEMBERSHIP_COPY[confirm.action].confirmLabel)
                : confirm?.kind === 'unassign'
                  ? t('common.remove')
                  : t('common.confirm')
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
