'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';

export default function AdminReportCardsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('page.reportCards.title')}
        description={t('page.reportCards.description')}
      />
      <Banner tone="info">{t('page.reportCards.soon')}</Banner>
      <ul className="list" style={{ marginTop: 'var(--space-4)' }}>
        <li>
          <Link className="card" href={`${base}/exams`}>
            <strong>{t('nav.exams')}</strong>
            <div className="muted">Enter and approve marks before report cards can print</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/students`}>
            <strong>{t('nav.students')}</strong>
            <div className="muted">Student registry for class and guardian links</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
