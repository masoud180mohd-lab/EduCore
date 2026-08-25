'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={`${t('parent.feesTitle')} — ${guardian?.displayName ?? t('parent.parent')}`}
          description={t('parent.feesDesc')}
        />
        <Banner tone="info">{t('parent.officePay')}</Banner>
        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && error === null && active.length === 0 ? (
          <Banner tone="info">{t('parent.noStudents')}</Banner>
        ) : null}

        {!loading && active.length > 0 ? (
          <div className="flex flex-col gap-3">
            {active.map((link) => (
              <Card key={link.id} className="transition-colors hover:bg-muted/40">
                <CardContent className="p-4">
                  <Link
                    className="flex items-center justify-between gap-3 text-foreground"
                    href={`/t/${tenantId}/parent/fees/students/${link.studentId}`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          {link.studentDisplayName ?? link.studentId}
                        </span>
                        {link.isPrimary ? (
                          <Badge variant="default">{t('common.primary')}</Badge>
                        ) : null}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {link.relationshipType} · {t('parent.viewInvoices')}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-primary">→</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </ParentShell>
  );
}

