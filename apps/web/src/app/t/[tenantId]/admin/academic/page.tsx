'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';

export default function AdminAcademicHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const base = `/t/${tenantId}/admin/academic`;

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Academic</h1>
      <p className="muted">
        School year tree and enrollments (ACF-003…008 / DSF-002). Structure entities support create
        and edit (rename, code, dates, status) — no delete.
      </p>
      <ul className="list">
        <li>
          <Link className="card" href={`${base}/years`}>
            <strong>Academic years</strong>
            <div className="muted">School years</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/terms`}>
            <strong>Terms</strong>
            <div className="muted">Terms within a year</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/classes`}>
            <strong>Classes</strong>
            <div className="muted">Classes by year</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/streams`}>
            <strong>Streams</strong>
            <div className="muted">Streams within a class</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/subjects`}>
            <strong>Subjects</strong>
            <div className="muted">Subject catalog</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/enrollments`}>
            <strong>Enrollments</strong>
            <div className="muted">Place students in classes</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
