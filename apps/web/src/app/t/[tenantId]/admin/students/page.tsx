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
import { type StudentRow, type StudentStatus, STUDENT_STATUSES } from '@/lib/students/types';

export default function AdminStudentsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | StudentStatus>('');
  const [appliedStatus, setAppliedStatus] = useState<'' | StudentStatus>('');
  const [displayName, setDisplayName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [createStatus, setCreateStatus] = useState<StudentStatus>('active');

  async function loadPage(opts: {
    readonly searchQ: string;
    readonly statusQ: '' | StudentStatus;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/students', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          search: opts.searchQ,
          status: opts.statusQ === '' ? undefined : opts.statusQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<StudentRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError(t('students.loadError'));
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
    const actionKey = `student.create:${displayName}:${studentCode}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        displayName: displayName.trim(),
        status: createStatus,
      };
      if (studentCode.trim() !== '') body['studentCode'] = studentCode.trim();
      const created = await apiRequest<{ data: StudentRow }>('/api/v1/students', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setDisplayName('');
      setStudentCode('');
      setCreateStatus('active');
      router.push(`/t/${tenantId}/admin/students/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError(t('students.createError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t('students.title')} description={t('students.description')} />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('students.add')}</CardTitle>
            <CardDescription>{t('students.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onCreate(e)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="displayName">{t('students.displayName')}</Label>
                  <Input
                    id="displayName"
                    required
                    maxLength={200}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Mwanafunzi Amina"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="studentCode">{t('students.studentCode')}</Label>
                  <Input
                    id="studentCode"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    pattern="[A-Za-z0-9._-]{1,64}"
                    title={t('students.codeHint')}
                    placeholder="STU-001"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 max-w-xs">
                <Label htmlFor="create-status">{t('common.status')}</Label>
                <select
                  id="create-status"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as StudentStatus)}
                >
                  {STUDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  placeholder={t('students.searchPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-2 min-w-[150px]">
                <Label htmlFor="list-status">{t('common.status')}</Label>
                <select
                  id="list-status"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as '' | StudentStatus)}
                >
                  <option value="">{t('common.allStatuses')}</option>
                  {STUDENT_STATUSES.map((s) => (
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
          empty={t('students.empty')}
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
            caption={t('students.title')}
            headers={[t('common.name'), t('common.code'), t('common.status'), '']}
          >
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">
                  <Link
                    href={`/t/${tenantId}/admin/students/${s.id}`}
                    className="hover:underline text-primary"
                  >
                    {s.displayName}
                  </Link>
                </td>
                <td className="text-muted-foreground">{s.studentCode ?? '—'}</td>
                <td>
                  <StatusChip label={s.status} />
                </td>
                <td className="admin-table-actions">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/t/${tenantId}/admin/students/${s.id}`}>{t('common.open')}</Link>
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
