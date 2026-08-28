'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { TeacherShell } from '@/components/TeacherShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildClassLabelMap, formatClassLabel } from '@/lib/academic/class-labels';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type SessionRow = {
  readonly id: string;
  readonly classId: string;
  readonly sessionDate: string;
  readonly status: string;
};

type ClassRow = { readonly id: string; readonly name: string; readonly code: string | null };

export default function TeacherHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [classLabels, setClassLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [sessionsRes, classesRes] = await Promise.all([
          apiRequest<{ data: SessionRow[] }>('/api/v1/attendance-sessions?limit=25', { auth }),
          apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
        ]);
        setRows(sessionsRes.data ?? []);
        setClassLabels(buildClassLabelMap(classesRes.data ?? []));
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError(t('common.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  return (
    <TeacherShell tenantId={tenantId}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminPageHeader title={t('teacher.sessions')} description={t('teacher.sessionsDesc')} />
          <Button asChild className="self-start sm:self-auto">
            <Link href={`/t/${tenantId}/teacher/attendance`}>{t('teacher.takeAttendance')}</Link>
          </Button>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && rows.length === 0 ? (
          <Banner tone="info">{t('teacher.noSessions')}</Banner>
        ) : null}

        <div className="flex flex-col gap-2">
          {rows.map((s) => (
            <Card key={s.id} className="transition-colors hover:bg-muted/40">
              <CardContent className="p-4">
                <Link
                  className="flex items-center justify-between gap-3 text-foreground"
                  href={`/t/${tenantId}/teacher/attendance/sessions/${s.id}`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.sessionDate}</span>
                      <Badge variant={s.status === 'open' ? 'default' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatClassLabel(classLabels, s.classId)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-primary">→</span>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TeacherShell>
  );
}
