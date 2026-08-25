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

type GuardianRow = {
  readonly id: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
};

type GuardianStatus = 'active' | 'inactive';

const GUARDIAN_STATUSES: ReadonlyArray<GuardianStatus> = ['active', 'inactive'];

export default function AdminGuardiansPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<GuardianRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | GuardianStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | GuardianStatus>('');

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly statusQ: '' | GuardianStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/guardians', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<GuardianRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError(t('guardians.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPage({ searchQ: '', statusQ: '', cursor: null, append: false });
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `guardian.create:${displayName}:${email}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { displayName: displayName.trim() };
      if (phone.trim() !== '') body['phone'] = phone.trim();
      if (email.trim() !== '') body['email'] = email.trim();
      const created = await apiRequest<{ data: GuardianRow }>('/api/v1/guardians', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setDisplayName('');
      setPhone('');
      setEmail('');
      router.push(`/t/${tenantId}/admin/guardians/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'guardians'));
      else setError(t('guardians.createError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t('guardians.title')} description={t('guardians.description')} />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('guardians.add')}</CardTitle>
            <CardDescription>{t('guardians.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onCreate(e)}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayName">{t('common.displayName')}</Label>
                  <Input
                    id="displayName"
                    required
                    maxLength={200}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Mama Amina"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">{t('common.phoneOptional')}</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t('common.emailOptional')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guardian@example.com"
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

        <Card>
          <CardContent className="pt-6">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedSearch(search);
                setAppliedStatus(statusFilter);
                void loadPage({
                  searchQ: search,
                  statusQ: statusFilter,
                  cursor: null,
                  append: false,
                });
              }}
            >
              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                <Label htmlFor="search">{t('common.search')}</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, or phone"
                />
              </div>
              <div className="flex flex-col gap-2 min-w-[150px]">
                <Label htmlFor="list-status">{t('common.status')}</Label>
                <select
                  id="list-status"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as '' | GuardianStatus)}
                >
                  <option value="">{t('common.allStatuses')}</option>
                  {GUARDIAN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" type="submit" disabled={loading || loadingMore}>
                {t('common.applyFilters')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <ResourceList
          loading={loading}
          empty={t('guardians.empty')}
          isEmpty={rows.length === 0}
          variant="table"
          footer={
            <ResourceListPagination
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadMore={() => {
                void loadPage({
                  searchQ: appliedSearch,
                  statusQ: appliedStatus,
                  cursor: nextCursor,
                  append: true,
                });
              }}
            />
          }
        >
          <AdminTable
            caption={t('guardians.title')}
            headers={[t('common.name'), t('common.phone'), t('common.status'), '']}
          >
            {rows.map((g) => (
              <tr key={g.id}>
                <td className="font-medium">
                  <Link
                    href={`/t/${tenantId}/admin/guardians/${g.id}`}
                    className="hover:underline text-primary"
                  >
                    {g.displayName}
                  </Link>
                </td>
                <td className="text-muted-foreground">{[g.email, g.phone].filter(Boolean).join(' · ') || '—'}</td>
                <td>
                  <StatusChip label={g.status} />
                </td>
                <td className="admin-table-actions">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/t/${tenantId}/admin/guardians/${g.id}`}>
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
