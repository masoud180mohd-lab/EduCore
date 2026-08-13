'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { readSession } from '@/lib/auth/session';
import {
  activeLinkedStudentIds,
  type GuardianStudentLink,
} from '@/lib/finance/guardian-fees-access';

type Guardian = {
  readonly id: string;
  readonly displayName: string;
};

type LinkRow = GuardianStudentLink & {
  readonly id: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
};

export default function GuardianFeesEntryPage() {
  const params = useParams<{ tenantId: string; guardianId: string }>();
  const { tenantId, guardianId } = params;

  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [gRes, lRes] = await Promise.all([
        apiRequest<{ data: Guardian }>(`/api/v1/guardians/${guardianId}`, { auth }),
        apiRequest<{ data: LinkRow[] }>(`/api/v1/guardians/${guardianId}/links`, { auth }),
      ]);
      setGuardian(gRes.data);
      const allLinks = lRes.data ?? [];
      setLinks(allLinks);
      const allowlist = activeLinkedStudentIds(allLinks);
      const nameMap: Record<string, string> = {};
      await Promise.all(
        [...allowlist].map(async (studentId) => {
          try {
            const st = await apiRequest<{ data: { displayName: string } }>(
              `/api/v1/students/${studentId}`,
              { auth },
            );
            nameMap[studentId] = st.data.displayName;
          } catch {
            nameMap[studentId] = studentId;
          }
        }),
      );
      setNames(nameMap);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load guardian fees.');
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeLinks = links.filter((l) => l.status === 'active');
  const base = `/t/${tenantId}/admin/guardians/${guardianId}`;

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`${base}`}>← Guardian</Link>
      </p>
      <AdminPageHeader title={`Fees — ${guardian?.displayName ?? 'Guardian'}`}>
        <p className="muted">
          Read-only invoices and balances for linked students (DSF-005 / IMP-011).
        </p>
      </AdminPageHeader>
      <Banner tone="info">
        Pay at the school office (cash, bank, or cheque). Mobile money is not enabled (PAY-007 /
        PAY-PROVIDER-001).
      </Banner>

      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && error === null && activeLinks.length === 0 ? (
        <Banner tone="info">
          Link a student to this guardian first, then return here to view fees.
        </Banner>
      ) : null}

      {!loading && activeLinks.length > 0 ? (
        <>
          <h2 style={{ fontSize: '1.1rem' }}>Linked students</h2>
          <ul className="list">
            {activeLinks.map((link) => (
              <li key={link.id}>
                <Link className="card" href={`${base}/fees/students/${link.studentId}`}>
                  <strong>{names[link.studentId] ?? link.studentId}</strong>
                  <div className="muted">
                    {link.relationshipType}
                    {link.isPrimary ? ' · primary' : ''} · View invoices
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AdminShell>
  );
}
