'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { type OrganizationRow, type OrgType, ORG_TYPES } from '@/lib/organizations/types';

export default function AdminOrganizationsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('school');
  const [parentOrganizationId, setParentOrganizationId] = useState('');

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/organizations', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: { search: opts.searchQ },
      });
      const result = await apiRequest<PaginatedEnvelope<OrganizationRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'organizations'));
      else setError('Could not load organizations.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ searchQ: '', cursor: null, append: false });
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
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'organizations'));
      else setError('Could not create organization.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title="Organizations"
        description="Campuses and organizational units. Create, edit, or deactivate."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">Add organization</h2>
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
          setAppliedSearch(search);
          void loadPage({ searchQ: search, cursor: null, append: false });
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
        <button className="btn btn-secondary" type="submit" disabled={loading || loadingMore}>
          Search
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No organizations yet."
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ searchQ: appliedSearch, cursor: nextCursor, append: true });
            }}
          />
        }
      >
        <AdminTable caption="Organizations" headers={['Name', 'Code', 'Type', 'Status', '']}>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/organizations/${o.id}`}>{o.name}</Link>
              </td>
              <td className="muted">{o.code ?? '—'}</td>
              <td className="muted">{o.orgType ?? '—'}</td>
              <td>
                <StatusChip label={o.status} tone={o.status === 'active' ? 'ok' : 'muted'} />
              </td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/organizations/${o.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
