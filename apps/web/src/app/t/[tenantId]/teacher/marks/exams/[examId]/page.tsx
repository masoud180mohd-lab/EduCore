'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { TeacherShell } from '@/components/TeacherShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type Exam = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
};

type ExamSubject = {
  readonly id: string;
  readonly subjectId: string;
  readonly maxScore: number | string;
  readonly status: string;
};

type SubjectRow = { readonly id: string; readonly name: string };

export default function ExamDetailPage() {
  const params = useParams<{ tenantId: string; examId: string }>();
  const { tenantId, examId } = params;
  const { t } = useAppPreferences();
  const [exam, setExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [catalog, setCatalog] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [exRes, subRes, catRes] = await Promise.all([
        apiRequest<{ data: Exam }>(`/api/v1/exams/${examId}`, { auth }),
        apiRequest<{ data: ExamSubject[] }>(`/api/v1/exams/${examId}/subjects`, { auth }),
        apiRequest<{ data: SubjectRow[] }>('/api/v1/subjects?limit=100&status=active', { auth }),
      ]);
      setExam(exRes.data);
      setSubjects(subRes.data ?? []);
      setCatalog(catRes.data ?? []);
      const map: Record<string, string> = {};
      for (const s of catRes.data ?? []) map[s.id] = s.name;
      setNames(map);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load exam.');
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddSubject(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || subjectId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `exam.subject:${examId}:${subjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/exams/${examId}/subjects`, {
        method: 'POST',
        auth,
        body: { subjectId, maxScore: Number(maxScore) },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setSubjectId('');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not add subject.');
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

        <AdminPageHeader title={exam?.name ?? t('teacher.exam')}>
          {exam !== null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>{t('common.status')}:</span>
              <Badge variant={exam.status === 'open' ? 'default' : 'secondary'}>
                {exam.status}
              </Badge>
            </div>
          ) : null}
        </AdminPageHeader>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('teacher.addSubject')}</CardTitle>
            <CardDescription>{t('teacher.marksDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onAddSubject(e)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subjectId">{t('common.subject')}</Label>
                  <select
                    id="subjectId"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">{t('common.selectSubject')}</option>
                    {catalog.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxScore">{t('common.maxScore')}</Label>
                  <Input
                    id="maxScore"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full sm:w-auto self-start"
                disabled={busy || subjectId === ''}
              >
                {busy ? t('common.adding') : t('teacher.addSubject')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t('teacher.subjects')}</h2>
          {subjects.length === 0 ? <Banner tone="info">{t('teacher.noSubjects')}</Banner> : null}

          <div className="flex flex-col gap-2.5">
            {subjects.map((s) => (
              <Card key={s.id} className="transition-colors hover:bg-muted/40">
                <CardContent className="p-4">
                  <Link
                    className="flex items-center justify-between gap-3 text-foreground"
                    href={`/t/${tenantId}/teacher/marks/subjects/${s.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{names[s.subjectId] ?? s.subjectId}</span>
                        <Badge variant={s.status === 'draft' ? 'secondary' : 'default'}>
                          {s.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {t('teacher.maxLabel', { score: String(s.maxScore) })}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-primary">→</span>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
