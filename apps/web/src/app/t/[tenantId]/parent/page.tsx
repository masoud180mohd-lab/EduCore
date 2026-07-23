'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ParentShell } from '@/components/ParentShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { activeLinkedStudentIds } from '@/lib/finance/guardian-fees-access';

type LinkRow = {
  readonly id: string;
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
  readonly studentDisplayName?: string;
};

type Guardian = {
  readonly id: string;
  readonly displayName: string;
};

function accessMessage(err: ApiClientError): string {
  if (err.status === 403) {
    return 'You do not have parent portal access.';
  }
  return teacherFriendlyMessage(err);
}

export default function ParentHomePage() {
  const params = useParams<{ tenantId: string }>();
  const { tenantId } = params;
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [gRes, lRes] = await Promise.all([
        apiRequest<{ data: Guardian }>('/api/v1/me/guardian', { auth }),
        apiRequest<{ data: LinkRow[] }>('/api/v1/me/guardian/links', { auth }),
      ]);
      setGuardian(gRes.data);
      setLinks(lRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err));
      else setError('Could not load parent fees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = links.filter((l) => l.status === 'active');
  void activeLinkedStudentIds(active);

  return (
    <ParentShell tenantId={tenantId}>
      <h1>Fees — {guardian?.displayName ?? 'Parent'}</h1>
      <p className="muted">Read-only invoices for your linked students (DSF-006 / ACF-013).</p>
      <div className="banner banner-info" role="status">
        Pay at the school office. Mobile money is not enabled (PAY-PROVIDER-001).
      </div>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && error === null && active.length === 0 ? (
        <div className="banner banner-info" role="status">
          No students are linked to your guardian account yet. Ask the school office to link a
          student.
        </div>
      ) : null}
      {!loading && active.length > 0 ? (
        <ul className="list">
          {active.map((link) => (
            <li key={link.id}>
              <Link className="card" href={`/t/${tenantId}/parent/fees/students/${link.studentId}`}>
                <strong>{link.studentDisplayName ?? link.studentId}</strong>
                <div className="muted">
                  {link.relationshipType}
                  {link.isPrimary ? ' · primary' : ''} · View invoices
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ParentShell>
  );
}
