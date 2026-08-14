'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { TeacherShell } from '@/components/TeacherShell';
import { useAppPreferences } from '@/components/AppProviders';
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
  }, []);

  return (
    <TeacherShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('teacher.sessions')}
        description={t('teacher.sessionsDesc')}
      />
      <p>
        <Link className="btn btn-primary" href={`/t/${tenantId}/teacher/attendance`}>
          {t('teacher.takeAttendance')}
        </Link>
      </p>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading && rows.length === 0 ? (
        <Banner tone="info">{t('teacher.noSessions')}</Banner>
      ) : null}
      <ul className="list">
        {rows.map((s) => (
          <li key={s.id}>
            <Link className="card" href={`/t/${tenantId}/teacher/attendance/sessions/${s.id}`}>
              <div>
                <strong>{s.sessionDate}</strong>{' '}
                <span className={`chip chip-${s.status === 'open' ? 'open' : 'closed'}`}>
                  {s.status}
                </span>
              </div>
              <div className="muted">{formatClassLabel(classLabels, s.classId)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </TeacherShell>
  );
}
