'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { TeacherShell } from '@/components/TeacherShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  type AttendanceRecordStatus,
  buildUpsertPayload,
  mergeRosterWithRecords,
  type MarkDraft,
  setStudentStatus,
} from '@/lib/attendance/mark-state';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

type Session = {
  readonly id: string;
  readonly classId: string;
  readonly streamId: string | null;
  readonly sessionDate: string;
  readonly status: string;
};

type Enrollment = { readonly studentId: string; readonly status: string };
type RecordRow = { readonly studentId: string; readonly status: string };
type Student = { readonly id: string; readonly displayName: string };
type ClassRow = { readonly id: string; readonly name: string; readonly code: string | null };

const STATUSES: readonly AttendanceRecordStatus[] = ['present', 'absent', 'late', 'excused'];

export default function MarkSessionPage() {
  const params = useParams<{ tenantId: string; sessionId: string }>();
  const { tenantId, sessionId } = params;
  const { t } = useAppPreferences();
  const [session, setSession] = useState<Session | null>(null);
  const [classLabel, setClassLabel] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MarkDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const closed = session?.status === 'closed';

  const presentCount = drafts.filter((d) => d.status === 'present').length;
  const absentCount = drafts.filter((d) => d.status === 'absent').length;
  const lateCount = drafts.filter((d) => d.status === 'late').length;
  const excusedCount = drafts.filter((d) => d.status === 'excused').length;
  const unmarkedCount = drafts.filter((d) => d.status === null).length;

  function onMarkAllPresent() {
    if (closed || busy) return;
    setDrafts((prev) => prev.map((d) => ({ ...d, status: 'present' })));
  }

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setError(null);
    try {
      const sessionRes = await apiRequest<{ data: Session }>(
        `/api/v1/attendance-sessions/${sessionId}`,
        { auth },
      );
      const sess = sessionRes.data;
      setSession(sess);

      try {
        const classRes = await apiRequest<{ data: ClassRow }>(`/api/v1/classes/${sess.classId}`, {
          auth,
        });
        const code =
          classRes.data.code !== null && classRes.data.code !== ''
            ? ` (${classRes.data.code})`
            : '';
        setClassLabel(`${classRes.data.name}${code}`);
      } catch {
        setClassLabel(null);
      }

      const enrollQs = new URLSearchParams({
        classId: sess.classId,
        status: 'active',
        limit: '100',
      });
      if (sess.streamId !== null) enrollQs.set('streamId', sess.streamId);

      const [enrollRes, recordsRes] = await Promise.all([
        apiRequest<{ data: Enrollment[] }>(`/api/v1/enrollments?${enrollQs.toString()}`, { auth }),
        apiRequest<{ data: RecordRow[] }>(`/api/v1/attendance-sessions/${sessionId}/records`, {
          auth,
        }),
      ]);

      const enrollments = enrollRes.data ?? [];
      const names: Record<string, string> = {};
      await Promise.all(
        enrollments.map(async (e) => {
          try {
            const st = await apiRequest<{ data: Student }>(`/api/v1/students/${e.studentId}`, {
              auth,
            });
            names[e.studentId] = st.data.displayName;
          } catch {
            names[e.studentId] = e.studentId;
          }
        }),
      );

      setDrafts(
        mergeRosterWithRecords({
          enrollments,
          records: recordsRes.data ?? [],
          names,
        }),
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    const auth = readSession();
    if (auth === null || closed) return;
    if (drafts.length === 0) {
      setError('No enrolled students to mark.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `records.upsert:${sessionId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/attendance-sessions/${sessionId}/records`, {
        method: 'PUT',
        auth,
        body: buildUpsertPayload(drafts),
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Marks saved.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runClose() {
    const auth = readSession();
    if (auth === null || closed) return;
    setBusy(true);
    setError(null);
    const actionKey = `session.close:${sessionId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: Session }>(
        `/api/v1/attendance-sessions/${sessionId}/close`,
        { method: 'POST', auth, idempotencyKey: idem },
      );
      clearIdempotencyKey(actionKey);
      setConfirmClose(false);
      setSession(result.data);
      setInfo('Session closed.');
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Close failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            href={`/t/${tenantId}/teacher/attendance`}
          >
            ← {t('teacher.takeAttendance')}
          </Link>
        </div>

        <AdminPageHeader title={t('teacher.markAttendance')}>
          {session !== null ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>{session.sessionDate}</span>
              <span>·</span>
              <span>{classLabel ?? t('common.class')}</span>
              <span>·</span>
              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                {session.status}
              </Badge>
            </div>
          ) : null}
        </AdminPageHeader>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && drafts.length === 0 ? (
          <Banner tone="warn">No active enrollments for this class.</Banner>
        ) : null}

        {/* Live Counters & Quick Actions */}
        {drafts.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                🟢 Wapo (Present): <strong className="tabular-nums text-sm">{presentCount}</strong>
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                🔴 Hawapo (Absent): <strong className="tabular-nums text-sm">{absentCount}</strong>
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                🟡 Wamechelewa (Late): <strong className="tabular-nums text-sm">{lateCount}</strong>
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                🔵 Ruhusa (Excused): <strong className="tabular-nums text-sm">{excusedCount}</strong>
              </span>
              {unmarkedCount > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border">
                  ⚪ Bado: <strong className="tabular-nums text-sm">{unmarkedCount}</strong>
                </span>
              )}
            </div>

            {!closed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                disabled={busy}
                onClick={onMarkAllPresent}
              >
                ✓ Weka Wote Wapo (Mark All Present)
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {drafts.map((d) => (
            <Card key={d.studentId} className="transition-colors hover:bg-muted/30">
              <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm sm:text-base text-foreground">
                    {d.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">{d.studentId}</span>
                </div>

                <div
                  className="flex flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label={`${t('common.status')} ${d.displayName}`}
                >
                  {STATUSES.map((status) => {
                    const isSelected = d.status === status;
                    return (
                      <label
                        key={status}
                        className={cn(
                          'flex items-center justify-center cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wider transition-all',
                          isSelected
                            ? status === 'present'
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                              : status === 'absent'
                                ? 'border-red-600 bg-red-600 text-white shadow-xs'
                                : status === 'late'
                                  ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                                  : 'border-blue-600 bg-blue-600 text-white shadow-xs'
                            : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                          (closed || busy) && 'pointer-events-none opacity-50',
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`status-${d.studentId}`}
                          value={status}
                          checked={isSelected}
                          disabled={closed || busy}
                          onChange={() =>
                            setDrafts((prev) => setStudentStatus(prev, d.studentId, status))
                          }
                        />
                        <span>{status}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-md backdrop-blur-sm">
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            disabled={closed || busy || drafts.length === 0}
            onClick={() => void onSave()}
          >
            {busy ? t('common.saving') : t('common.save')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1 sm:flex-none"
            disabled={closed || busy}
            onClick={() => setConfirmClose(true)}
          >
            {t('common.close')}
          </Button>
        </div>

        <ConfirmDialog
          open={confirmClose}
          title={t('teacher.closeSession')}
          body="Marks cannot be edited after closing."
          confirmLabel={t('common.close')}
          danger
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirmClose(false);
          }}
          onConfirm={() => {
            void runClose();
          }}
        />
      </div>
    </TeacherShell>
  );
}
