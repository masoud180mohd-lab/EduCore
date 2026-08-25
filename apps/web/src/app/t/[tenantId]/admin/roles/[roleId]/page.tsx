'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type PermissionRow, type RoleRow } from '@/lib/roles/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminRoleDetailPage() {
  const params = useParams<{ tenantId: string; roleId: string }>();
  const { tenantId, roleId } = params;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<RoleRow | null>(null);
  const [catalog, setCatalog] = useState<PermissionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [roleResult, permResult] = await Promise.all([
        apiRequest<{ data: RoleRow }>(`/api/v1/roles/${roleId}`, { auth }),
        apiRequest<{ data: PermissionRow[] }>('/api/v1/permissions', { auth }),
      ]);
      setRow(roleResult.data);
      setName(roleResult.data.name);
      setSelected(new Set(roleResult.data.permissions));
      setCatalog(permResult.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not load role.');
    }
  }, [roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  function togglePermission(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onRename(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `role.patch:${roleId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: RoleRow }>(`/api/v1/roles/${roleId}`, {
        method: 'PATCH',
        auth,
        body: { name: name.trim() },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Role renamed.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not rename role.');
    } finally {
      setBusy(false);
    }
  }

  async function onSavePermissions(event: FormEvent) {
    event.preventDefault();
    if (row === null || row.isSystem) return;
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `role.permissions:${roleId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: RoleRow }>(`/api/v1/roles/${roleId}/permissions`, {
        method: 'PUT',
        auth,
        body: { permissionCodes: [...selected].sort() },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo(t('roles.permissionsUpdated'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not update permissions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/t/${tenantId}/admin/roles`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {t('roles.title')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <AdminPageHeader title={row?.name || t('roles.role')}>
              {row !== null ? (
                <div className="text-sm text-muted-foreground mt-1">
                  Code: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.code}</code> · {row.isSystem ? 'System' : 'Custom'}
                </div>
              ) : null}
            </AdminPageHeader>
          </div>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}

        {row !== null ? (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('common.displayName')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4 max-w-md" onSubmit={(e) => void onRename(e)}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">{t('common.displayName')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Button type="submit" disabled={busy}>
                      {busy ? t('common.saving') : t('common.save')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {row.isSystem ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('roles.permissions')}</CardTitle>
                  <CardDescription>{t('roles.systemReadOnly')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {row.permissions.map((code) => (
                      <div key={code} className="rounded border bg-muted/40 p-2.5 text-xs font-mono">
                        {code}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('roles.permissions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={(e) => void onSavePermissions(e)}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {catalog.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={selected.has(perm.code)}
                            onChange={() => togglePermission(perm.code)}
                          />
                          <div className="text-sm">
                            <strong className="font-semibold block">{perm.code}</strong>
                            <span className="text-xs text-muted-foreground">{perm.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div>
                      <Button type="submit" disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        ) : error === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
