'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

export default function AdminHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [school, setSchool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<TenantCurrent>('/api/v1/tenants/current', { auth });
        setSchool(result.data.name ?? result.data.code ?? result.data.id);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load school.');
      }
    })();
  }, []);

  const base = `/t/${tenantId}/admin`;

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Admin</h1>
      <p className="muted">{school !== null ? school : 'Loading school…'}</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <ul className="list">
        <li>
          <Link className="card" href={`${base}/users`}>
            <strong>Users</strong>
            <div className="muted">Staff directory</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/memberships`}>
            <strong>Memberships</strong>
            <div className="muted">Roster by status</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/organizations`}>
            <strong>Organizations</strong>
            <div className="muted">Campuses and units</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/students`}>
            <strong>Students</strong>
            <div className="muted">Student registry</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/guardians`}>
            <strong>Guardians</strong>
            <div className="muted">Parents and links</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/roles`}>
            <strong>Roles</strong>
            <div className="muted">Permissions and assignments</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/academic`}>
            <strong>Academic</strong>
            <div className="muted">Years, classes, subjects, enrollments</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/fees`}>
            <strong>Fees</strong>
            <div className="muted">Structures, invoices, office payments</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/settings`}>
            <strong>Settings</strong>
            <div className="muted">Tenant settings document</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
