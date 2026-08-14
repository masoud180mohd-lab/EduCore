'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, AdminTable, Banner, ResourceList } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { buildClassLabelMap, formatClassLabel } from '@/lib/academic/class-labels';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type SessionRow = {
  readonly id: string;
  readonly classId: string;
  readonly sessionDate: string;
  readonly status: string;
};

type ClassRow = { readonly id: string; readonly name: string; readonly code?: string | null };

export default function AdminAttendancePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [classLabels, setClassLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(cursor: string | null, append: boolean) {
    const auth = readSession();
    if (auth === null) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/attendance-sessions', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor,
      });
      const [sessions, classes] = await Promise.all([
        apiRequest<PaginatedEnvelope<SessionRow>>(q, { auth }),
        apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
      ]);
      const page = readPageMeta(sessions);
      setRows((prev) => (append ? appendById(prev, sessions.data ?? []) : [...(sessions.data ?? [])]));
      setNextCursor(page.nextCursor);
      setClassLabels(buildClassLabelMap(classes.data ?? []));
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load attendance sessions.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load(null, false);
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('page.attendance.title')}
        description={t('page.attendance.description')}
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      <p className="stack">
        <Link className="btn btn-primary" href={`/t/${tenantId}/teacher/attendance`}>
          {t('common.open')} — {t('shell.teacherAttendance')}
        </Link>
      </p>
      <ResourceList
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        empty="No attendance sessions yet."
        variant="table"
        footer={
          nextCursor !== null ? (
            <p>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loadingMore}
                onClick={() => void load(nextCursor, true)}
              >
                {loadingMore ? 'Loading more…' : 'Load more'}
              </button>
            </p>
          ) : undefined
        }
      >
        <AdminTable caption="Attendance sessions" headers={['Date', 'Class', 'Status']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.sessionDate}</td>
              <td>{formatClassLabel(classLabels, row.classId)}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
