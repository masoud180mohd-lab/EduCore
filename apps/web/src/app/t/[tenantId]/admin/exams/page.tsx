'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, AdminTable, Banner, ResourceList } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { buildClassLabelMap, formatClassLabel } from '@/lib/academic/class-labels';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type ExamRow = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
};

type ClassRow = { readonly id: string; readonly name: string; readonly code?: string | null };

export default function AdminExamsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [classLabels, setClassLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [exams, classes] = await Promise.all([
          apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', { auth }),
          apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
        ]);
        setRows(exams.data ?? []);
        setClassLabels(buildClassLabelMap(classes.data ?? []));
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
        else setError('Could not load exams.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader title={t('page.exams.title')} description={t('page.exams.description')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      <p className="stack">
        <Link className="btn btn-primary" href={`/t/${tenantId}/teacher/marks`}>
          {t('common.open')} — {t('nav.exams')}
        </Link>
      </p>
      <ResourceList
        loading={loading}
        isEmpty={!loading && rows.length === 0}
        empty={t('exams.empty')}
        variant="table"
      >
        <AdminTable
          caption={t('exams.caption')}
          headers={[t('common.name'), t('common.class'), t('common.status'), '']}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{formatClassLabel(classLabels, row.classId)}</td>
              <td>{row.status}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/teacher/marks/exams/${row.id}`}
                >
                  {t('common.open')}
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
