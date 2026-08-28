'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';

export default function AdminStaffPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader title={t('page.staff.title')} description={t('page.staff.description')} />
      <ul className="list">
        <li>
          <Link className="card" href={`${base}/users`}>
            <strong>{t('nav.users')}</strong>
            <div className="muted">{t('staff.usersHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/memberships`}>
            <strong>{t('nav.memberships')}</strong>
            <div className="muted">{t('staff.membershipsHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/roles`}>
            <strong>{t('nav.roles')}</strong>
            <div className="muted">{t('staff.rolesHint')}</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`/t/${tenantId}/teacher`}>
            <strong>{t('shell.teacherAttendance')}</strong>
            <div className="muted">{t('staff.teacherHint')}</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
