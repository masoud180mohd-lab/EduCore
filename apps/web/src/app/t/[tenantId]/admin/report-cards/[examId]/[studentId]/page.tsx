'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, AdminTable, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiDownload, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type ReportCardDetail = {
  readonly studentId: string;
  readonly studentName: string;
  readonly className: string;
  readonly examId: string;
  readonly examName: string;
  readonly averagePercent: number | null;
  readonly overallGrade: string | null;
  readonly subjects: ReadonlyArray<{
    readonly subjectName: string;
    readonly score: number | null;
    readonly maxScore: number;
    readonly percent: number | null;
    readonly grade: string | null;
  }>;
};

export default function AdminReportCardDetailPage() {
  const params = useParams<{ tenantId: string; examId: string; studentId: string }>();
  const tenantId = params.tenantId;
  const examId = params.examId;
  const studentId = params.studentId;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<ReportCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: ReportCardDetail }>(
          `/api/v1/exams/${examId}/report-cards/${studentId}`,
          { auth },
        );
        setRow(result.data);
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
        else setError('Could not load report card.');
      }
    })();
  }, [examId, studentId]);

  async function onDownload() {
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    try {
      const blob = await apiDownload(`/api/v1/exams/${examId}/report-cards/${studentId}/pdf`, {
        auth,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-card-${row.studentName.replace(/\s+/g, '-').slice(0, 40)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not download PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted no-print">
        <Link href={`/t/${tenantId}/admin/report-cards`}>← {t('page.reportCards.title')}</Link>
      </p>
      <AdminPageHeader
        title={row?.studentName ?? t('page.reportCards.title')}
        description={
          row === null
            ? t('common.loading')
            : `${row.examName} · ${t('reportCards.class')}: ${row.className}`
        }
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {row !== null ? (
        <>
          <p className="stack no-print">
            <span>
              {t('reportCards.average')}:{' '}
              {row.averagePercent === null ? '—' : `${String(row.averagePercent)}%`} ·{' '}
              {t('reportCards.grade')}: {row.overallGrade ?? '—'}
            </span>
            <span className="actions">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                {t('reportCards.print')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void onDownload()}
              >
                {t('reportCards.downloadPdf')}
              </button>
            </span>
          </p>
          {row.subjects.length === 0 ? (
            <Banner tone="info">{t('reportCards.noMarks')}</Banner>
          ) : (
            <AdminTable
              caption={t('page.reportCards.title')}
              headers={[
                t('reportCards.subject'),
                t('reportCards.score'),
                t('reportCards.max'),
                t('reportCards.percent'),
                t('reportCards.grade'),
              ]}
            >
              {row.subjects.map((subject) => (
                <tr key={`${subject.subjectName}-${String(subject.maxScore)}`}>
                  <td>{subject.subjectName}</td>
                  <td>{subject.score === null ? '—' : String(subject.score)}</td>
                  <td>{subject.maxScore}</td>
                  <td>{subject.percent === null ? '—' : `${String(subject.percent)}%`}</td>
                  <td>{subject.grade ?? '—'}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </>
      ) : error === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : null}
    </AdminShell>
  );
}
