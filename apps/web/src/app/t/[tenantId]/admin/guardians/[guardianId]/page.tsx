'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { ConfirmDialog, ResourceListPagination } from '@/components/admin';
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
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { type BindUserOption, formatUserBindLabel } from '@/lib/guardians/bind-user-label';

type Guardian = {
  readonly id: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly userId: string | null;
};

type LinkRow = {
  readonly id: string;
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
};

type StudentRow = { readonly id: string; readonly displayName: string };

type GuardianStatus = 'active' | 'inactive';

type ConfirmState =
  { readonly kind: 'end-link'; readonly linkId: string } | { readonly kind: 'unbind' } | null;

const GUARDIAN_STATUSES: ReadonlyArray<GuardianStatus> = ['active', 'inactive'];

export default function AdminGuardianDetailPage() {
  const params = useParams<{ tenantId: string; guardianId: string }>();
  const { tenantId, guardianId } = params;
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsCursor, setStudentsCursor] = useState<string | null>(null);
  const [loadingMoreStudents, setLoadingMoreStudents] = useState(false);
  const [users, setUsers] = useState<BindUserOption[]>([]);
  const [usersCursor, setUsersCursor] = useState<string | null>(null);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [relationshipType, setRelationshipType] = useState('guardian');
  const [bindUserId, setBindUserId] = useState('');
  const [showAdvancedUuid, setShowAdvancedUuid] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<GuardianStatus>('active');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const loadUsers = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (!opts.append) setUsersLoading(true);
      else setLoadingMoreUsers(true);
      if (!opts.append) setUsersError(null);
      try {
        const result = await apiRequest<PaginatedEnvelope<BindUserOption>>(
          buildListQuery('/api/v1/users', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setUsers((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setUsersCursor(page.nextCursor);
      } catch (err) {
        if (!opts.append) {
          setUsers([]);
          setUsersCursor(null);
          if (err instanceof ApiClientError && err.status === 403) {
            setUsersError(
              'Cannot load users for the picker (needs user.read). Use advanced UUID paste or ask an admin.',
            );
          } else if (err instanceof ApiClientError) {
            setUsersError(adminFriendlyMessage(err, 'users'));
          } else {
            setUsersError('Could not load users.');
          }
        }
      } finally {
        setUsersLoading(false);
        setLoadingMoreUsers(false);
      }
    },
    [],
  );

  const loadStudentPicker = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setLoadingMoreStudents(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<StudentRow>>(
          buildListQuery('/api/v1/students', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
            filters: { status: 'active' },
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setStudents((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setStudentsCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setStudents([]);
          setStudentsCursor(null);
        }
      } finally {
        setLoadingMoreStudents(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setError(null);
    try {
      const [gRes, lRes] = await Promise.all([
        apiRequest<{ data: Guardian }>(`/api/v1/guardians/${guardianId}`, { auth }),
        apiRequest<{ data: LinkRow[] }>(`/api/v1/guardians/${guardianId}/links`, { auth }),
      ]);
      setGuardian(gRes.data);
      setDisplayName(gRes.data.displayName);
      setPhone(gRes.data.phone ?? '');
      setEmail(gRes.data.email ?? '');
      setStatus((gRes.data.status as GuardianStatus) === 'inactive' ? 'inactive' : 'active');
      setLinks(lRes.data ?? []);
      const nameMap: Record<string, string> = {};
      await Promise.all(
        (lRes.data ?? []).map(async (link) => {
          try {
            const st = await apiRequest<{ data: StudentRow }>(
              `/api/v1/students/${link.studentId}`,
              { auth },
            );
            nameMap[link.studentId] = st.data.displayName;
          } catch {
            nameMap[link.studentId] = link.studentId;
          }
        }),
      );
      setNames(nameMap);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError('Could not load guardian.');
    }
  }, [guardianId]);

  useEffect(() => {
    void load();
    void loadUsers({ cursor: null, append: false });
    void loadStudentPicker({ cursor: null, append: false });
  }, [load, loadUsers, loadStudentPicker]);

  async function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || guardian === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.patch:${guardianId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: Guardian }>(`/api/v1/guardians/${guardianId}`, {
        method: 'PATCH',
        auth,
        body: {
          displayName: displayName.trim(),
          phone: phone.trim() === '' ? null : phone.trim(),
          email: email.trim() === '' ? null : email.trim(),
          status,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Guardian profile updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError('Could not update guardian.');
    } finally {
      setBusy(false);
    }
  }

  async function onLink(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || studentId === '') return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.link:${guardianId}:${studentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/links`, {
        method: 'POST',
        auth,
        body: { studentId, relationshipType },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Student linked.');
      setStudentId('');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError('Could not link student.');
    } finally {
      setBusy(false);
    }
  }

  async function runEnd(linkId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/links/${linkId}/end`, {
        method: 'POST',
        auth,
      });
      setConfirm(null);
      setInfo('Link ended.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError('Could not end link.');
    } finally {
      setBusy(false);
    }
  }

  async function onBind(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    const userId = bindUserId.trim();
    if (auth === null || userId === '') return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.bind:${guardianId}:${userId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/bind-user`, {
        method: 'POST',
        auth,
        body: { userId },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Portal user bound. They can sign in and open Parent fees.');
      setBindUserId('');
      setShowAdvancedUuid(false);
      await load();
      await loadUsers({ cursor: null, append: false });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setError(
          'Cannot bind: this guardian or user is already bound (conflict). Unbind first or pick another user.',
        );
      } else if (err instanceof ApiClientError) {
        setError(adminFriendlyMessage(err, 'guardians'));
      } else {
        setError('Could not bind user.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function runUnbind() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.unbind:${guardianId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/unbind-user`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Portal user unbound.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError('Could not unbind user.');
    } finally {
      setBusy(false);
    }
  }

  const boundUser =
    guardian?.userId !== null && guardian?.userId !== undefined
      ? (users.find((u) => u.id === guardian.userId) ?? { id: guardian.userId })
      : null;
  const boundLabel = boundUser !== null ? formatUserBindLabel(boundUser) : null;

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/guardians`}>← Guardians</Link>
      </p>
      <h1>{guardian?.displayName ?? 'Guardian'}</h1>
      <p>
        <Link
          className="btn btn-secondary"
          href={`/t/${tenantId}/admin/guardians/${guardianId}/fees`}
        >
          View fees (read-only)
        </Link>
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

      {guardian !== null ? (
        <form className="stack card" onSubmit={(e) => void onSaveProfile(e)}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Profile</h2>
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              required
              maxLength={200}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              maxLength={32}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as GuardianStatus)}
            >
              {GUARDIAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="muted">Id: {guardian.id}</div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}

      <h2 style={{ fontSize: '1.1rem' }}>Portal bind</h2>
      <p className="muted">
        Bind an existing school user (active membership) so they can open the parent fees portal.
      </p>
      {usersError !== null ? (
        <div className="banner banner-error" role="alert">
          {usersError}
        </div>
      ) : null}
      {guardian?.userId !== null && guardian?.userId !== undefined ? (
        <div className="card stack">
          <div>
            <strong>{boundLabel ?? 'Bound user'}</strong>
            <div className="muted">{guardian.userId}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setConfirm({ kind: 'unbind' })}
          >
            Unbind user
          </button>
        </div>
      ) : (
        <form className="stack card" onSubmit={(e) => void onBind(e)}>
          {!usersLoading && usersError === null && users.length === 0 ? (
            <div className="banner banner-info" role="status">
              No users returned for this school. Create a membership first, or use advanced UUID
              paste.
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="bindUserSelect">School user</label>
            <select
              id="bindUserSelect"
              value={showAdvancedUuid ? '' : bindUserId}
              disabled={usersLoading || users.length === 0 || showAdvancedUuid}
              onChange={(e) => setBindUserId(e.target.value)}
              required={!showAdvancedUuid}
            >
              <option value="">{usersLoading ? 'Loading users…' : 'Select user to bind'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUserBindLabel(u)}
                </option>
              ))}
            </select>
            <ResourceListPagination
              nextCursor={usersCursor}
              loadingMore={loadingMoreUsers}
              disabled={showAdvancedUuid}
              onLoadMore={() => {
                void loadUsers({ cursor: usersCursor, append: true });
              }}
            />
          </div>
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowAdvancedUuid((v) => !v);
                setBindUserId('');
              }}
            >
              {showAdvancedUuid ? 'Hide advanced UUID' : 'Advanced: paste user UUID'}
            </button>
          </div>
          {showAdvancedUuid ? (
            <div className="field">
              <label htmlFor="bindUserId">User ID (UUID)</label>
              <input
                id="bindUserId"
                required
                value={bindUserId}
                onChange={(e) => setBindUserId(e.target.value)}
                placeholder="User UUID with active membership"
              />
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy || bindUserId === ''}>
            {busy ? 'Saving…' : 'Bind portal user'}
          </button>
        </form>
      )}

      <h2 style={{ fontSize: '1.1rem' }}>Linked students</h2>
      {links.length === 0 ? <div className="banner banner-info">No links yet.</div> : null}
      <ul className="list">
        {links.map((link) => (
          <li key={link.id} className="card">
            <strong>{names[link.studentId] ?? link.studentId}</strong>
            <div className="muted">
              {link.relationshipType} · {link.status}
              {link.isPrimary ? ' · primary' : ''}
            </div>
            {link.status === 'active' ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setConfirm({ kind: 'end-link', linkId: link.id })}
              >
                End link
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <form className="stack card" onSubmit={(e) => void onLink(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Link student</h2>
        <div className="field">
          <label htmlFor="studentId">Student</label>
          <select
            id="studentId"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={studentsCursor}
            loadingMore={loadingMoreStudents}
            onLoadMore={() => {
              void loadStudentPicker({ cursor: studentsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="relationshipType">Relationship</label>
          <select
            id="relationshipType"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || studentId === ''}>
          {busy ? 'Saving…' : 'Link'}
        </button>
      </form>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'unbind' ? 'Unbind portal user?' : 'End guardian link?'}
        body={
          confirm?.kind === 'unbind'
            ? 'Unbind portal user from this guardian? They will lose Parent portal access for this guardian.'
            : 'End this guardian link? The student will no longer be linked to this guardian.'
        }
        confirmLabel={confirm?.kind === 'unbind' ? 'Unbind' : 'End link'}
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          if (confirm?.kind === 'unbind') void runUnbind();
          else if (confirm?.kind === 'end-link') void runEnd(confirm.linkId);
        }}
      />
    </AdminShell>
  );
}
