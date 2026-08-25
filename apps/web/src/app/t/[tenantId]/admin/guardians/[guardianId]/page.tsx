'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import {
  AdminPageHeader,
  Banner,
  ConfirmDialog,
  ResourceListPagination,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { t } = useAppPreferences();
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
            setUsersError(t('users.loadError'));
          }
        }
      } finally {
        setUsersLoading(false);
        setLoadingMoreUsers(false);
      }
    },
    [t],
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
      setInfo(t('guardians.linkEnded'));
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href={`/t/${tenantId}/admin/guardians`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {t('guardians.title')}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <AdminPageHeader title={guardian?.displayName ?? t('guardians.guardian')} />
            <Button asChild variant="secondary">
              <Link href={`/t/${tenantId}/admin/guardians/${guardianId}/fees`}>
                {t('guardians.fees')}
              </Link>
            </Button>
          </div>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}

        {guardian !== null ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('common.profile')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4 max-w-md" onSubmit={(e) => void onSaveProfile(e)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayName">{t('common.displayName')}</Label>
                  <Input
                    id="displayName"
                    required
                    maxLength={200}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">{t('common.phoneOptional')}</Label>
                  <Input
                    id="phone"
                    maxLength={32}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t('common.emailOptional')}</Label>
                  <Input
                    id="email"
                    type="email"
                    maxLength={320}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="status">{t('common.status')}</Label>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                <div>
                  <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : error === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('guardians.portalBind')}</CardTitle>
            <CardDescription>{t('guardians.portalBindDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {usersError !== null ? <Banner tone="error">{usersError}</Banner> : null}
            {guardian?.userId !== null && guardian?.userId !== undefined ? (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <strong className="text-sm font-semibold">{boundLabel ?? t('guardians.boundUser')}</strong>
                  <div className="text-xs text-muted-foreground">{guardian.userId}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'unbind' })}
                >
                  {t('guardians.unbindUser')}
                </Button>
              </div>
            ) : (
              <form className="flex flex-col gap-4 max-w-md" onSubmit={(e) => void onBind(e)}>
                {!usersLoading && usersError === null && users.length === 0 ? (
                  <Banner tone="info">{t('guardians.noUsers')}</Banner>
                ) : null}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bindUserSelect">{t('guardians.schoolUser')}</Label>
                  <select
                    id="bindUserSelect"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={showAdvancedUuid ? '' : bindUserId}
                    disabled={usersLoading || users.length === 0 || showAdvancedUuid}
                    onChange={(e) => setBindUserId(e.target.value)}
                    required={!showAdvancedUuid}
                  >
                    <option value="">
                      {usersLoading ? t('guardians.loadingUsers') : t('guardians.selectUser')}
                    </option>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAdvancedUuid((v) => !v);
                      setBindUserId('');
                    }}
                  >
                    {showAdvancedUuid ? t('guardians.hideUuid') : t('guardians.showUuid')}
                  </Button>
                </div>
                {showAdvancedUuid ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="bindUserId">{t('guardians.userId')}</Label>
                    <Input
                      id="bindUserId"
                      required
                      value={bindUserId}
                      onChange={(e) => setBindUserId(e.target.value)}
                      placeholder={t('guardians.userIdPlaceholder')}
                    />
                  </div>
                ) : null}
                <div>
                  <Button type="submit" disabled={busy || bindUserId === ''}>
                    {busy ? t('common.saving') : t('guardians.bindUser')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('guardians.linkedStudents')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {links.length === 0 ? <Banner tone="info">{t('guardians.noLinks')}</Banner> : null}
            <ul className="flex flex-col gap-2">
              {links.map((link) => (
                <li key={link.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <strong className="text-sm font-semibold">{names[link.studentId] ?? link.studentId}</strong>
                    <div className="text-xs text-muted-foreground mt-1">
                      {link.relationshipType} · {link.status}
                      {link.isPrimary ? ` · ${t('common.primary')}` : ''}
                    </div>
                  </div>
                  {link.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'end-link', linkId: link.id })}
                    >
                      {t('guardians.endLink')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <form className="flex flex-col gap-4 border-t pt-4 max-w-md" onSubmit={(e) => void onLink(e)}>
              <h3 className="text-sm font-semibold">{t('guardians.linkStudent')}</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="studentId">{t('students.student')}</Label>
                <select
                  id="studentId"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">{t('common.selectStudent')}</option>
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="relationshipType">{t('common.relationship')}</Label>
                <select
                  id="relationshipType"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                >
                  <option value="mother">{t('rel.mother')}</option>
                  <option value="father">{t('rel.father')}</option>
                  <option value="guardian">{t('rel.guardian')}</option>
                  <option value="other">{t('rel.other')}</option>
                </select>
              </div>
              <div>
                <Button type="submit" disabled={busy || studentId === ''}>
                  {busy ? t('common.saving') : t('guardians.link')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirm !== null}
          title={confirm?.kind === 'unbind' ? t('guardians.unbindTitle') : t('guardians.endLinkTitle')}
          body={
            confirm?.kind === 'unbind' ? t('guardians.unbindBody') : t('guardians.endLinkBody')
          }
          confirmLabel={confirm?.kind === 'unbind' ? t('guardians.unbindUser') : t('guardians.endLink')}
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
      </div>
    </AdminShell>
  );
}
