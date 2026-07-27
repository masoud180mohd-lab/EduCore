'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { ResourceList, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { type RoleRow, roleMessage } from '@/lib/roles/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

const ROLES_PAGE_LIMIT = 100;

export default function AdminRolesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  async function loadPage(opts: { readonly cursor: string | null; readonly append: boolean }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/roles', {
        limit: ROLES_PAGE_LIMIT,
        cursor: opts.cursor,
      });
      const result = await apiRequest<PaginatedEnvelope<RoleRow>>(q, { auth });
      const page = readPageMeta(result, ROLES_PAGE_LIMIT);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(roleMessage(err));
      else setError('Could not load roles.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ cursor: null, append: false });
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

      <ResourceList
        loading={loading}
        empty="No roles found."
        isEmpty={rows.length === 0}
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ cursor: nextCursor, append: true });
            }}
          />
        }
      >
        {rows.map((role) => (
          <li key={role.id}>
            <Link className="card" href={`/t/${tenantId}/admin/roles/${role.id}`}>
              <strong>{role.name}</strong>
              <div className="muted">
                {role.code}
                {role.isSystem ? ' · system' : ' · custom'} · {role.permissions.length} permissions
              </div>
            </Link>
          </li>
        ))}
      </ResourceList>
    </AdminShell>
  );
}
