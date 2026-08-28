'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, AdminTable, Banner, ResourceList } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiDownload, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type ExamRow = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
};

type ReportCardList = {
  readonly exam: { readonly id: string; readonly name: string };
  readonly className: string;
  readonly students: ReadonlyArray<{
    readonly studentId: string;
    readonly studentName: string;
    readonly averagePercent: number | null;
    readonly overallGrade: string | null;
  }>;
};

export default function AdminReportCardsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [examId, setExamId] = useState('');
  const [payload, setPayload] = useState<ReportCardList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', { auth });
        setExams(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
        else setError('Could not load exams.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (examId === '') {
      setPayload(null);
      return;
    }
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      setLoading(true);
      try {
        const result = await apiRequest<{ data: ReportCardList }>(
          `/api/v1/exams/${examId}/report-cards`,
          { auth },
        );
        setPayload(result.data);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
        else setError('Could not load report cards.');
        setPayload(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  async function onDownload(studentId: string, studentName: string) {
    const auth = readSession();
    if (auth === null || examId === '') return;
    setBusyId(studentId);
    try {
      const blob = await apiDownload(`/api/v1/exams/${examId}/report-cards/${studentId}/pdf`, {
        auth,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${studentName.replace(/\s+/g, '-').slice(0, 40)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not download PDF.');
    } finally {
      setBusyId(null);
    }
  }

  const rows = payload?.students ?? [];

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('page.reportCards.title')}
        description={t('page.reportCards.description')}
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <div className="field" style={{ maxWidth: '28rem', marginBottom: 'var(--space-4)' }}>
        <label htmlFor="rc-exam">{t('reportCards.pickExam')}</label>
        <select id="rc-exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">{t('reportCards.pickExam')}</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name} ({exam.status})
            </option>
          ))}
        </select>
      </div>

      {payload !== null ? (
        <p className="muted">
          {t('reportCards.class')}: {payload.className}
        </p>
      ) : null}

      <ResourceList
        loading={loading && examId !== ''}
        isEmpty={!loading && examId !== '' && rows.length === 0}
        empty={t('reportCards.empty')}
        variant="table"
      >
        <AdminTable
          caption={t('page.reportCards.title')}
          headers={[t('fees.student'), t('reportCards.average'), t('reportCards.grade'), '']}
        >
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>{row.studentName}</td>
              <td>{row.averagePercent === null ? '—' : `${String(row.averagePercent)}%`}</td>
              <td>{row.overallGrade ?? '—'}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/report-cards/${examId}/${row.studentId}`}
                >
                  {t('common.open')}
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === row.studentId}
                  onClick={() => void onDownload(row.studentId, row.studentName)}
                >
                  {t('reportCards.downloadPdf')}
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
