'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';

export default function AdminAnnouncementsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('page.announcements.title')}
        description={t('page.announcements.description')}
      />
      <Banner tone="info">{t('page.announcements.soon')}</Banner>
      <ul className="list" style={{ marginTop: 'var(--space-4)' }}>
        <li>
          <Link className="card" href={`${base}/notifications`}>
            <strong>{t('nav.notifications')}</strong>
            <div className="muted">{t('announcements.smsHint')}</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
