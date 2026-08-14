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
            <div className="muted">Invite staff, edit profiles, suspend or enable accounts</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/memberships`}>
            <strong>{t('nav.memberships')}</strong>
            <div className="muted">Roster by invited / active / suspended / removed</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/roles`}>
            <strong>{t('nav.roles')}</strong>
            <div className="muted">Custom roles and permission checklists</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`/t/${tenantId}/teacher`}>
            <strong>{t('shell.teacherAttendance')}</strong>
            <div className="muted">Teachers mark attendance and enter marks from the teacher workspace</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
