'use client';

import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { TeacherShell } from '@/components/TeacherShell';
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
      <AdminPageHeader
        title="Take attendance"
        description="Pick class and date to open or resume a session."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loadingClasses ? <p className="muted">Loading classes…</p> : null}
      {!loadingClasses && classes.length === 0 ? (
        <Banner tone="info">No active classes yet. Ask an admin to create one.</Banner>
      ) : null}
      <form className="stack" onSubmit={(e) => void onOpen(e)}>
        <div className="field">
          <label htmlFor="classId">Class</label>
          <select
            id="classId"
            required
            disabled={loadingClasses || classes.length === 0}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStreamId('');
            }}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.code !== null ? ` (${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="streamId">Stream (optional)</label>
          <select id="streamId" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">Whole class</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sessionDate">Date</label>
          <input
            id="sessionDate"
            type="date"
            required
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || classId === ''}>
          {busy ? 'Opening…' : 'Open session'}
        </button>
      </form>
    </TeacherShell>
  );
}
