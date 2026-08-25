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
import { Input } from '@/components/ui/input';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ExamSubject = {
  readonly id: string;
  readonly examId: string;
  readonly subjectId: string;
  readonly maxScore: number | string;
  readonly status: string;
};

type Exam = { readonly id: string; readonly classId: string; readonly name: string };
type MarkRow = {
  readonly studentId: string;
  readonly score: number | string | null;
  readonly note: string | null;
};
type Enrollment = { readonly studentId: string };
type Student = { readonly id: string; readonly displayName: string };

type Draft = {
  readonly studentId: string;
  readonly displayName: string;
  readonly score: string;
};

export default function MarkEntryPage() {
  const params = useParams<{ tenantId: string; examSubjectId: string }>();
  const { tenantId, examSubjectId } = params;
  const { t } = useAppPreferences();
  const [subject, setSubject] = useState<ExamSubject | null>(null);
  const [examName, setExamName] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const locked = subject !== null && subject.status !== 'draft';
  const canApprove = subject?.status === 'submitted';

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setError(null);
    try {
      const subjectRes = await apiRequest<{ data: ExamSubject }>(
        `/api/v1/exam-subjects/${examSubjectId}`,
        { auth },
      );
      const found = subjectRes.data;
      setSubject(found);

      const [examRes, marksRes] = await Promise.all([
        apiRequest<{ data: Exam }>(`/api/v1/exams/${found.examId}`, { auth }),
        apiRequest<{ data: MarkRow[] }>(`/api/v1/exam-subjects/${examSubjectId}/marks`, {
          auth,
        }),
      ]);
      setExamName(examRes.data.name);

      const enrollRes = await apiRequest<{ data: Enrollment[] }>(
        `/api/v1/enrollments?classId=${encodeURIComponent(examRes.data.classId)}&status=active&limit=100`,
        { auth },
      );

      const markMap = new Map((marksRes.data ?? []).map((m) => [m.studentId, m] as const));
      const next: Draft[] = [];
      for (const en of enrollRes.data ?? []) {
        let displayName = en.studentId;
        try {
          const st = await apiRequest<{ data: Student }>(`/api/v1/students/${en.studentId}`, {
            auth,
          });
          displayName = st.data.displayName;
        } catch {
          // id fallback
        }
        const existing = markMap.get(en.studentId);
        next.push({
          studentId: en.studentId,
          displayName,
          score:
            existing?.score === null || existing?.score === undefined ? '' : String(existing.score),
        });
      }
      setDrafts(next);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load marks.');
    } finally {
      setLoading(false);
    }
  }, [examSubjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    const auth = readSession();
    if (auth === null || locked) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `marks.upsert:${examSubjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/marks`, {
        method: 'PUT',
        auth,
        body: {
          records: drafts.map((d) => ({
            studentId: d.studentId,
            score: d.score.trim() === '' ? null : Number(d.score),
          })),
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo(t('teacher.marksSaved'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runSubmit() {
    const auth = readSession();
    if (auth === null || locked) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/submit`, {
        method: 'POST',
        auth,
      });
      setConfirmSubmit(false);
      setInfo(t('teacher.submitted'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Submit failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    const auth = readSession();
    if (auth === null || !canApprove) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/approve`, {
        method: 'POST',
        auth,
      });
      setInfo(t('teacher.approved'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Approve failed.');
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
            href={`/t/${tenantId}/teacher/marks`}
          >
            ← {t('teacher.marksTitle')}
          </Link>
        </div>

        <AdminPageHeader title={t('teacher.enterMarks')}>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
            <span>{examName}</span>
            {subject !== null ? (
              <>
                <span>·</span>
                <span>{t('teacher.maxLabel', { score: String(subject.maxScore) })}</span>
                <span>·</span>
                <Badge variant={subject.status === 'draft' ? 'secondary' : 'default'}>
                  {subject.status}
                </Badge>
              </>
            ) : null}
          </div>
        </AdminPageHeader>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && drafts.length === 0 ? (
          <Banner tone="warn">{t('teacher.noEnrollments')}</Banner>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {drafts.map((d) => (
            <Card key={d.studentId} className="transition-colors hover:bg-muted/30">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm sm:text-base text-foreground">
                    {d.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">{d.studentId}</span>
                </div>

                <div className="flex items-center gap-2 max-w-[7rem]">
                  <Input
                    id={`score-${d.studentId}`}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Score"
                    className="h-9 text-right"
                    disabled={locked || busy}
                    value={d.score}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDrafts((prev) =>
                        prev.map((row) =>
                          row.studentId === d.studentId ? { ...row, score: value } : row,
                        ),
                      );
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-md backdrop-blur-sm">
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            disabled={locked || busy || drafts.length === 0}
            onClick={() => void onSave()}
          >
            {busy ? t('common.saving') : t('common.save')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 sm:flex-none"
            disabled={locked || busy}
            onClick={() => setConfirmSubmit(true)}
          >
            {t('common.submit')}
          </Button>
          {canApprove ? (
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={() => void onApprove()}
            >
              {t('common.approve')}
            </Button>
          ) : null}
        </div>

        <ConfirmDialog
          open={confirmSubmit}
          title={t('teacher.submitMarks')}
          body={t('teacher.submitBody')}
          confirmLabel={t('common.submit')}
          danger
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirmSubmit(false);
          }}
          onConfirm={() => {
            void runSubmit();
          }}
        />
      </div>
    </TeacherShell>
  );
}

