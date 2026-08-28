'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { HeadShell } from '@/components/HeadShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { formatTzsMinor } from '@/lib/finance/money';

type StudentSummary = {
  readonly total: number;
};

type InvoiceSummary = {
  readonly collectedMinor: number;
  readonly outstandingMinor: number;
  readonly overdueCount: number;
};

type AttendanceSummary = {
  readonly present: number;
  readonly absent: number;
  readonly late: number;
  readonly excused: number;
};

async function loadOptionalSummary<T>(path: string): Promise<T | null> {
  const auth = readSession();
  if (auth === null) return null;
  try {
    const result = await apiRequest<{ data: T }>(path, { auth });
    return result.data;
  } catch (err) {
    if (err instanceof ApiClientError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    throw err;
  }
}

export default function HeadDashboardPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const settled = await Promise.allSettled([
          loadOptionalSummary<StudentSummary>('/api/v1/students/summary'),
          loadOptionalSummary<InvoiceSummary>('/api/v1/invoices/summary'),
          loadOptionalSummary<AttendanceSummary>('/api/v1/attendance-sessions/summary'),
        ]);
        if (settled[0]?.status === 'fulfilled') setStudents(settled[0].value);
        if (settled[1]?.status === 'fulfilled') setInvoices(settled[1].value);
        if (settled[2]?.status === 'fulfilled') setAttendance(settled[2].value);
        if (settled.some((s) => s.status === 'rejected')) {
          setError(t('kpi.loadError'));
        }
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'tenant'));
        else setError(t('common.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const showKpis = students !== null || invoices !== null || attendance !== null;

  return (
    <HeadShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminPageHeader title={t('head.dashboardTitle')} description={t('head.dashboardDesc')} />
          <Button asChild className="self-start sm:self-auto">
            <Link href={`/t/${tenantId}/head/approvals`}>{t('head.openApprovals')}</Link>
          </Button>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {!loading && !showKpis ? <Banner tone="info">{t('head.noKpis')}</Banner> : null}

        {showKpis ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={t('common.dashboard')}
          >
            {students !== null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                    {t('kpi.students')}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {students.total.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {t('students.title')}
                </CardContent>
              </Card>
            ) : null}

            {invoices !== null ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      {t('kpi.collected')}
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatTzsMinor(invoices.collectedMinor)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {t('fees.title')}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      {t('kpi.outstanding')}
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatTzsMinor(invoices.outstandingMinor)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {t('fees.invoices')}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      {t('kpi.overdue')}
                    </CardDescription>
                    <CardTitle className="text-3xl font-bold tabular-nums text-destructive">
                      {invoices.overdueCount}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    {t('fees.invoices')}
                  </CardContent>
                </Card>
              </>
            ) : null}

            {attendance !== null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                    {t('kpi.attendanceToday')}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums text-primary">
                    {attendance.present}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">
                    {t('kpi.present')}: {attendance.present}
                  </span>
                  {' · '}
                  <span className="text-red-500 font-medium">
                    {t('kpi.absent')}: {attendance.absent}
                  </span>
                  {attendance.late > 0 ? (
                    <>
                      {' · '}
                      <span className="text-amber-500 font-medium">
                        {t('kpi.late')}: {attendance.late}
                      </span>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </HeadShell>
  );
}
