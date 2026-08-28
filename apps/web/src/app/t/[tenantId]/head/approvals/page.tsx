'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { HeadShell } from '@/components/HeadShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildClassLabelMap, formatClassLabel } from '@/lib/academic/class-labels';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ExamRow = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
};

type ExamSubject = {
  readonly id: string;
  readonly subjectId: string;
  readonly status: string;
  readonly maxScore?: number | string;
};

type ClassRow = { readonly id: string; readonly name: string; readonly code: string | null };
type SubjectRow = { readonly id: string; readonly name: string };

type QueueItem = {
  readonly examSubjectId: string;
  readonly examId: string;
  readonly examName: string;
  readonly classLabel: string;
  readonly subjectName: string;
};

export default function HeadApprovalsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [exRes, clRes, subRes] = await Promise.all([
        apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', { auth }),
        apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
        apiRequest<{ data: SubjectRow[] }>('/api/v1/subjects?limit=100&status=active', { auth }),
      ]);
      const classLabels = buildClassLabelMap(clRes.data ?? []);
      const subjectNames: Record<string, string> = {};
      for (const s of subRes.data ?? []) subjectNames[s.id] = s.name;

      const queue: QueueItem[] = [];
      const exams = exRes.data ?? [];
      await Promise.all(
        exams.map(async (exam) => {
          try {
            const subjects = await apiRequest<{ data: ExamSubject[] }>(
              `/api/v1/exams/${exam.id}/subjects`,
              { auth },
            );
            for (const row of subjects.data ?? []) {
              if (row.status !== 'submitted') continue;
              queue.push({
                examSubjectId: row.id,
                examId: exam.id,
                examName: exam.name,
                classLabel: formatClassLabel(classLabels, exam.classId),
                subjectName: subjectNames[row.subjectId] ?? row.subjectId,
              });
            }
          } catch {
            /* skip exam on error */
          }
        }),
      );
      setItems(queue);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(examSubjectId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusyId(examSubjectId);
    setSuccess(null);
    setError(null);
    const actionKey = `exam_subject.approve:${examSubjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/approve`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
        body: {},
      });
      clearIdempotencyKey(actionKey);
      setSuccess(t('head.approveSuccess'));
      setConfirmId(null);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError(t('head.approveFailed'));
    } finally {
      setBusyId(null);
    }
  }

  const confirmItem = items.find((i) => i.examSubjectId === confirmId) ?? null;

  return (
    <HeadShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            href={`/t/${tenantId}/head`}
          >
            ← {t('head.dashboardTitle')}
          </Link>
        </div>

        <AdminPageHeader title={t('head.approvalsTitle')} description={t('head.approvalsDesc')} />

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {success !== null ? <Banner tone="info">{success}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && items.length === 0 ? (
          <Banner tone="info">{t('head.noApprovals')}</Banner>
        ) : null}

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.examSubjectId} className="transition-colors hover:bg-muted/30">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{item.examName}</span>
                    <Badge variant="secondary">submitted</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.classLabel} · {item.subjectName}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="self-start sm:self-auto"
                  disabled={busyId === item.examSubjectId}
                  onClick={() => setConfirmId(item.examSubjectId)}
                >
                  {t('head.approve')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirmItem !== null}
        title={t('head.approveConfirmTitle')}
        body={
          confirmItem !== null
            ? t('head.approveConfirmBody', {
                exam: confirmItem.examName,
                subject: confirmItem.subjectName,
              })
            : ''
        }
        confirmLabel={t('head.approve')}
        danger
        busy={busyId !== null}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId !== null) void approve(confirmId);
        }}
      />
    </HeadShell>
  );
}
