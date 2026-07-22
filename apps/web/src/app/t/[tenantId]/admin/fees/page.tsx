'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminShell } from '@/components/AdminShell';

export default function AdminFeesHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const base = `/t/${tenantId}/admin/fees`;

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Fees</h1>
      <p className="muted">
        Bursar workflow: fee structures → invoices → office payment → receipts (ACF-012 / DSF-004).
        Mobile money is not enabled.
      </p>
      <ul className="list">
        <li>
          <Link className="card" href={`${base}/structures`}>
            <strong>Fee structures</strong>
            <div className="muted">Named fee items by academic year</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/invoices`}>
            <strong>Invoices</strong>
            <div className="muted">Draft, issue, void, and record office payments</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/receipts`}>
            <strong>Receipts</strong>
            <div className="muted">Issued payment receipts</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
