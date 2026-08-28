'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';

export default function AdminReportsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('page.reports.title')}
        description={t('page.reports.description')}
      />
      <Banner tone="info">{t('reports.soonHint')}</Banner>
      <ul className="list" style={{ marginTop: 'var(--space-4)' }}>
        <li>
          <Link className="card" href={`${base}/students`}>
            <strong>{t('nav.students')}</strong>
            <div className="muted">{t('reports.studentsHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/attendance`}>
            <strong>{t('nav.attendance')}</strong>
            <div className="muted">{t('reports.attendanceHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/fees/invoices`}>
            <strong>{t('nav.fees')}</strong>
            <div className="muted">{t('reports.feesHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/exams`}>
            <strong>{t('nav.exams')}</strong>
            <div className="muted">{t('reports.examsHint')}</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
