'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type PermissionRow, type RoleRow } from '@/lib/roles/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminRoleDetailPage() {
  const params = useParams<{ tenantId: string; roleId: string }>();
  const { tenantId, roleId } = params;
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
      setInfo('Permissions updated.');
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
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/roles`}>← Roles</Link>
      </p>
      <AdminPageHeader title={row?.name || 'Role'}>
        {row !== null ? (
          <p className="muted">
            Code: {row.code} · {row.isSystem ? 'System' : 'Custom'}
          </p>
        ) : null}
      </AdminPageHeader>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}

      {row !== null ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onRename(e)}>
            <label className="field">
              <span>Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save name'}
            </button>
          </form>

          {row.isSystem ? (
            <div className="stack">
              <h2>Permissions</h2>
              <p className="muted">System role grants are read-only (reconcile via ops).</p>
              <ul className="list">
                {row.permissions.map((code) => (
                  <li key={code} className="muted">
                    {code}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <form className="card stack" onSubmit={(e) => void onSavePermissions(e)}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Permissions</h2>
              <div className="stack">
                {catalog.map((perm) => (
                  <label
                    key={perm.id}
                    className="field"
                    style={{ flexDirection: 'row', gap: '0.5rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(perm.code)}
                      onChange={() => togglePermission(perm.code)}
                    />
                    <span>
                      <strong>{perm.code}</strong>
                      <span className="muted"> — {perm.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save permissions'}
              </button>
            </form>
          )}
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
