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
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { type RoleRow } from '@/lib/roles/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

const ROLES_PAGE_LIMIT = 100;

export default function AdminRolesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
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
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
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
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'roles'));
      else setError('Could not create role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t('roles.title')} description={t('roles.description')} />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('roles.create')}</CardTitle>
            <CardDescription>{t('roles.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 max-w-lg" onSubmit={(e) => void onCreate(e)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">{t('common.code')}</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    pattern="^[a-z][a-z0-9_]{1,63}$"
                    placeholder="e.g. bursar_clerk"
                    maxLength={64}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t('common.name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Bursar Clerk"
                  />
                </div>
              </div>
              <div>
                <Button type="submit" disabled={busy}>
                  {busy ? t('common.saving') : t('common.create')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ResourceList
          loading={loading}
          empty={t('roles.empty')}
          isEmpty={rows.length === 0}
          variant="table"
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
          <AdminTable
            caption={t('roles.title')}
            headers={[t('common.name'), t('common.code'), t('roles.kind'), t('roles.permissions'), '']}
          >
            {rows.map((role) => (
              <tr key={role.id}>
                <td className="font-medium">
                  <Link
                    href={`/t/${tenantId}/admin/roles/${role.id}`}
                    className="hover:underline text-primary"
                  >
                    {role.name}
                  </Link>
                </td>
                <td className="text-muted-foreground">{role.code}</td>
                <td className="text-muted-foreground">{role.isSystem ? t('roles.system') : t('roles.custom')}</td>
                <td className="text-muted-foreground">{role.permissions.length}</td>
                <td className="admin-table-actions">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/t/${tenantId}/admin/roles/${role.id}`}>
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
