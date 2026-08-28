'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { TeacherShell } from '@/components/TeacherShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildClassLabelMap, formatClassLabel } from '@/lib/academic/class-labels';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ExamRow = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
  readonly academicYearId: string;
};

type ClassRow = { readonly id: string; readonly name: string };
type YearRow = { readonly id: string; readonly name: string };

export default function MarksHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classLabels, setClassLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [years, setYears] = useState<YearRow[]>([]);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [exRes, clRes, yrRes] = await Promise.all([
          apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', { auth }),
          apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
          apiRequest<{ data: YearRow[] }>('/api/v1/academic-years?limit=50', { auth }),
        ]);
        const classRows = clRes.data ?? [];
        setExams(exRes.data ?? []);
        setClasses(classRows);
        setClassLabels(buildClassLabelMap(classRows));
        setYears(yrRes.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load exams.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `exam.create:${name}:${classId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: ExamRow }>('/api/v1/exams', {
        method: 'POST',
        auth,
        body: { name: name.trim(), classId, academicYearId, status: 'open' },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      router.push(`/t/${tenantId}/teacher/marks/exams/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not create exam.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={t('teacher.marksTitle')} description={t('teacher.marksDesc')} />
        {error !== null ? <Banner tone="error">{error}</Banner> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('teacher.newExam')}</CardTitle>
            <CardDescription>{t('teacher.marksDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={(e) => void onCreate(e)}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t('common.name')}</Label>
                <Input
                  id="name"
                  required
                  placeholder="Midterm Exam 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="academicYearId">{t('academic.year')}</Label>
                  <select
                    id="academicYearId"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                  >
                    <option value="">{t('common.selectYear')}</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="classId">{t('common.class')}</Label>
                  <select
                    id="classId"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    required
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    <option value="">{t('common.selectClass')}</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 w-full sm:w-auto self-start"
                disabled={busy || classId === '' || academicYearId === '' || name.trim() === ''}
              >
                {busy ? t('common.creating') : t('teacher.createExam')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && exams.length === 0 ? (
          <Banner tone="info">{t('teacher.noExams')}</Banner>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {exams.map((exam) => (
            <Card key={exam.id} className="transition-colors hover:bg-muted/40">
              <CardContent className="p-4">
                <Link
                  className="flex items-center justify-between gap-3 text-foreground"
                  href={`/t/${tenantId}/teacher/marks/exams/${exam.id}`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{exam.name}</span>
                      <Badge variant={exam.status === 'open' ? 'default' : 'secondary'}>
                        {exam.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatClassLabel(classLabels, exam.classId)}
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
