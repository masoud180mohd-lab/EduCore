'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { StudentShell } from '@/components/StudentShell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type MeStudent = {
  readonly id: string;
  readonly displayName: string;
  readonly studentCode: string | null;
  readonly status: string;
};

function accessMessage(err: ApiClientError, noAccess: string): string {
  if (err.status === 403 || err.status === 404) {
    return noAccess;
  }
  return teacherFriendlyMessage(err);
}

export default function StudentHomePage() {
  const params = useParams<{ tenantId: string }>();
  const { tenantId } = params;
  const { t } = useAppPreferences();
  const [student, setStudent] = useState<MeStudent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ data: MeStudent }>('/api/v1/me/student', { auth });
      setStudent(res.data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err, t('student.noAccess')));
      else setError(t('student.loadError'));
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <StudentShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={t('student.homeTitle')}
          description={t('student.homeDesc')}
        />

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

        {!loading && student !== null ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-xl">{student.displayName}</CardTitle>
                <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                  {student.status}
                </Badge>
              </div>
              <CardDescription>
                {student.studentCode ? `${student.studentCode} · ` : ''}
                {t('student.homeTitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('student.profileHint')}</p>
            </CardContent>
          </Card>
        ) : null}

        {!loading && error === null ? (
          <div className="grid gap-4 sm:grid-cols-3" aria-label={t('student.comingSoon')}>
            {(
              [
                ['student.soonAttendance', 'student.soonAttendanceDesc'],
                ['student.soonResults', 'student.soonResultsDesc'],
                ['student.soonFees', 'student.soonFeesDesc'],
              ] as const
            ).map(([titleKey, descKey]) => (
              <Card key={titleKey} className="transition-colors hover:bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{t(titleKey)}</CardTitle>
                  <CardDescription className="text-xs">{t(descKey)}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </StudentShell>
  );
}

