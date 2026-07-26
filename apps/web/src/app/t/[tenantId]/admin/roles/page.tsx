'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type RoleRow, roleMessage } from '@/lib/roles/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminRolesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  async function load() {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const result = await apiRequest<{ data: RoleRow[] }>('/api/v1/roles?limit=100', { auth });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(roleMessage(err));
      else setError('Could not load roles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `role.create:${code}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: RoleRow }>('/api/v1/roles', {
        method: 'POST',
        auth,
        body: { code: code.trim(), name: name.trim() },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setCode('');
      setName('');
      router.push(`/t/${tenantId}/admin/roles/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(roleMessage(err));
      else setError('Could not create role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Roles</h1>
      <p className="muted">
        Tenant roles and permission sets (ACF-001). System roles cannot delete.
      </p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create custom role</h2>
        <label className="field">
          <span>Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            pattern="^[a-z][a-z0-9_]{1,63}$"
            placeholder="e.g. bursar_clerk"
            maxLength={64}
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create role'}
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No roles found.</p>
      ) : (
        <ul className="list">
          {rows.map((role) => (
            <li key={role.id}>
              <Link className="card" href={`/t/${tenantId}/admin/roles/${role.id}`}>
                <strong>{role.name}</strong>
                <div className="muted">
                  {role.code}
                  {role.isSystem ? ' · system' : ' · custom'} · {role.permissions.length}{' '}
                  permissions
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
