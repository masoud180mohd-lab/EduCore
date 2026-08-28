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
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { t } = useAppPreferences();
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
  const [parentOptions, setParentOptions] = useState<OrganizationRow[]>([]);
  const [parentsCursor, setParentsCursor] = useState<string | null>(null);
  const [loadingMoreParents, setLoadingMoreParents] = useState(false);

  async function loadParentPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreParents(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<OrganizationRow>>(
        buildListQuery('/api/v1/organizations', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
          filters: { status: 'active' },
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setParentOptions((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setParentsCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setParentOptions([]);
        setParentsCursor(null);
      }
    } finally {
      setLoadingMoreParents(false);
    }
  }

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreParents(true);
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
    void loadParentPicker({ cursor: null, append: false });
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
      if (parentOrganizationId !== '') {
        body['parentOrganizationId'] = parentOrganizationId;
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
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t('orgs.title')} description={t('orgs.description')} />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('orgs.add')}</CardTitle>
            <CardDescription>{t('orgs.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onCreate(e)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t('common.name')}</Label>
                  <Input
                    id="name"
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Campus / Branch Name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">{t('common.codeOptional')}</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    pattern="[a-z0-9-]{2,64}"
                    title={t('orgs.codeHint')}
                    placeholder="branch-main"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="orgType">Type</Label>
                  <select
                    id="orgType"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value as OrgType)}
                  >
                    {ORG_TYPES.map((typeCode) => (
                      <option key={typeCode} value={typeCode}>
                        {typeCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="parentOrganizationId">Parent organization (optional)</Label>
                  <select
                    id="parentOrganizationId"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={parentOrganizationId}
                    onChange={(e) => setParentOrganizationId(e.target.value)}
                  >
                    <option value="">None</option>
                    {parentOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.code !== null && o.code !== '' ? ` (${o.code})` : ''}
                      </option>
                    ))}
                  </select>
                  <ResourceListPagination
                    nextCursor={parentsCursor}
                    loadingMore={loadingMoreParents}
                    onLoadMore={() => {
                      void loadParentPicker({ cursor: parentsCursor, append: true });
                    }}
                  />
                </div>
              </div>

              <div>
                <Button type="submit" disabled={busy || name.trim() === ''}>
                  {busy ? t('common.saving') : t('common.create')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedSearch(search);
                void loadPage({ searchQ: search, cursor: null, append: false });
              }}
            >
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                <Label htmlFor="search">{t('common.search')}</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or code"
                />
              </div>
              <Button variant="secondary" type="submit" disabled={loading || loadingMore}>
                {t('common.search')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <ResourceList
          loading={loading}
          empty={t('orgs.empty')}
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
          <AdminTable
            caption={t('orgs.title')}
            headers={[t('common.name'), t('common.code'), 'Type', t('common.status'), '']}
          >
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="font-medium">
                  <Link
                    href={`/t/${tenantId}/admin/organizations/${o.id}`}
                    className="hover:underline text-primary"
                  >
                    {o.name}
                  </Link>
                </td>
                <td className="text-muted-foreground">{o.code ?? '—'}</td>
                <td className="text-muted-foreground">{o.orgType ?? '—'}</td>
                <td>
                  <StatusChip label={o.status} tone={o.status === 'active' ? 'ok' : 'muted'} />
                </td>
                <td className="admin-table-actions">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/t/${tenantId}/admin/organizations/${o.id}`}>
                      {t('common.open')}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </ResourceList>
      </div>
    </AdminShell>
  );
}
