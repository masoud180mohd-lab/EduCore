'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { useAppPreferences } from '@/components/AppProviders';
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

function accessMessage(err: ApiClientError, noAccess: string): string {
  if (err.status === 403) {
    return noAccess;
  }
  return teacherFriendlyMessage(err);
}

export default function ParentHomePage() {
  const params = useParams<{ tenantId: string }>();
  const { tenantId } = params;
  const { t } = useAppPreferences();
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
      if (err instanceof ApiClientError) setError(accessMessage(err, t('parent.noAccess')));
      else setError(t('parent.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = links.filter((l) => l.status === 'active');
  void activeLinkedStudentIds(active);

  return (
    <ParentShell tenantId={tenantId}>
      <AdminPageHeader
        title={`${t('parent.feesTitle')} — ${guardian?.displayName ?? t('parent.parent')}`}
        description={t('parent.feesDesc')}
      />
      <Banner tone="info">{t('parent.officePay')}</Banner>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading && error === null && active.length === 0 ? (
        <Banner tone="info">{t('parent.noStudents')}</Banner>
      ) : null}
      {!loading && active.length > 0 ? (
        <ul className="list">
          {active.map((link) => (
            <li key={link.id}>
              <Link className="card" href={`/t/${tenantId}/parent/fees/students/${link.studentId}`}>
                <strong>{link.studentDisplayName ?? link.studentId}</strong>
                <div className="muted">
                  {link.relationshipType}
                  {link.isPrimary ? ` · ${t('common.primary')}` : ''} · {t('parent.viewInvoices')}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ParentShell>
  );
}
