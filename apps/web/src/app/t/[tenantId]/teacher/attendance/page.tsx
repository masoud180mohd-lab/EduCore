'use client';

import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { TeacherShell } from '@/components/TeacherShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ClassRow = { readonly id: string; readonly name: string; readonly code: string | null };
type StreamRow = { readonly id: string; readonly name: string; readonly classId: string };
type SessionRow = {
  readonly id: string;
  readonly classId: string;
  readonly sessionDate: string;
  readonly status: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePickerPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      setLoadingClasses(true);
      try {
        const result = await apiRequest<{ data: ClassRow[] }>(
          '/api/v1/classes?limit=100&status=active',
          {
            auth,
          },
        );
        setClasses(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      } finally {
        setLoadingClasses(false);
      }
    })();
  }, []);

  useEffect(() => {
    const auth = readSession();
    if (auth === null || classId === '') {
      setStreams([]);
      return;
    }
    void (async () => {
      try {
        const result = await apiRequest<{ data: StreamRow[] }>(
          `/api/v1/streams?limit=100&classId=${encodeURIComponent(classId)}`,
          { auth },
        );
        setStreams(result.data ?? []);
      } catch {
        setStreams([]);
      }
    })();
  }, [classId]);

  async function onOpen(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `session.open:${classId}:${streamId}:${sessionDate}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { classId, sessionDate };
      if (streamId !== '') body['streamId'] = streamId;
      const created = await apiRequest<{ data: SessionRow }>('/api/v1/attendance-sessions', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      router.push(`/t/${tenantId}/teacher/attendance/sessions/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        try {
          const q = new URLSearchParams({
            classId,
            sessionDate,
            limit: '5',
          });
          const list = await apiRequest<{ data: SessionRow[] }>(
            `/api/v1/attendance-sessions?${q.toString()}`,
            { auth },
          );
          const match = list.data.find(
            (s) => s.classId === classId && s.sessionDate === sessionDate,
          );
          if (match !== undefined) {
            clearIdempotencyKey(actionKey);
            router.push(`/t/${tenantId}/teacher/attendance/sessions/${match.id}`);
            return;
          }
        } catch {
          // fall through
        }
      }
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not open session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={t('teacher.takeAttendance')}
          description={t('teacher.takeDesc')}
        />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loadingClasses ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loadingClasses && classes.length === 0 ? (
          <Banner tone="info">{t('teacher.noClasses')}</Banner>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('teacher.takeAttendance')}</CardTitle>
            <CardDescription>{t('teacher.takeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onOpen(e)}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="classId">{t('common.class')}</Label>
                <select
                  id="classId"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  required
                  disabled={loadingClasses || classes.length === 0}
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setStreamId('');
                  }}
                >
                  <option value="">{t('common.selectClass')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.code !== null ? ` (${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="streamId">{t('common.streamOptional')}</Label>
                <select
                  id="streamId"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                >
                  <option value="">{t('teacher.wholeClass')}</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sessionDate">{t('common.date')}</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="mt-2 w-full sm:w-auto self-start"
                disabled={busy || classId === ''}
              >
                {busy ? t('common.loading') : t('common.open')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TeacherShell>
  );
}

