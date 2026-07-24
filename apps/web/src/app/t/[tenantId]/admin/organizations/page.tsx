'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type OrganizationRow,
  type OrgType,
  ORG_TYPES,
  organizationMessage,
} from '@/lib/organizations/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminOrganizationsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('school');
  const [parentOrganizationId, setParentOrganizationId] = useState('');

  async function load(searchQ: string) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const q =
        searchQ.trim() !== ''
          ? `/api/v1/organizations?limit=50&search=${encodeURIComponent(searchQ.trim())}`
          : '/api/v1/organizations?limit=50';
      const result = await apiRequest<{ data: OrganizationRow[] }>(q, { auth });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(organizationMessage(err));
      else setError('Could not load organizations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `org.create:${name}:${code}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        orgType,
        name: name.trim(),
      };
      if (code.trim() !== '') body['code'] = code.trim();
      if (parentOrganizationId.trim() !== '') {
        body['parentOrganizationId'] = parentOrganizationId.trim();
      }
      const created = await apiRequest<{ data: OrganizationRow }>('/api/v1/organizations', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      setOrgType('school');
      setParentOrganizationId('');
      router.push(`/t/${tenantId}/admin/organizations/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(organizationMessage(err));
      else setError('Could not create organization.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Organizations</h1>
      <p className="muted">Campuses and organizational units. Create, edit, or deactivate.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add organization</h2>
        <div className="field">
          <label htmlFor="orgType">Type</label>
          <select
            id="orgType"
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as OrgType)}
          >
            {ORG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="code">Code (optional)</label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            pattern="[a-z0-9-]{2,64}"
            title="Lowercase letters, numbers, hyphens; 2–64 characters"
          />
        </div>
        <div className="field">
          <label htmlFor="parentOrganizationId">Parent organization id (optional)</label>
          <input
            id="parentOrganizationId"
            value={parentOrganizationId}
            onChange={(e) => setParentOrganizationId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Creating…' : 'Create organization'}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          void load(search);
        }}
      >
        <div className="field">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No organizations yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((o) => (
          <li key={o.id} className="card">
            <Link href={`/t/${tenantId}/admin/organizations/${o.id}`}>
              <strong>{o.name}</strong>
            </Link>
            <div className="muted">{[o.code, o.orgType, o.status].filter(Boolean).join(' · ')}</div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
