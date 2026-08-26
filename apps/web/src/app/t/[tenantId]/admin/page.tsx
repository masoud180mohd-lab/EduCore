'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users, UserCheck, Percent, Wallet } from 'lucide-react';

import { Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ADMIN_HUB_BY_ID,
  visibleAdminHubQuickStarts,
  type AdminHubCard,
} from '@/lib/admin/admin-hub';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { groupAdminNav, visibleAdminNavIds, type AdminNavId } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { readSession } from '@/lib/auth/session';
import { formatTzsMinor } from '@/lib/finance/money';
import { groupMessageKey, hubBlurbKey, navMessageKey, quickHintKey, quickLabelKey } from '@/lib/i18n/messages';
import { headmasterProfile, formatTzs } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

type MeEnvelope = {
  readonly data: MeLike;
};

type StudentSummary = {
  readonly total: number;
  readonly byStatus: Readonly<Record<string, number>>;
};

type InvoiceSummary = {
  readonly collectedMinor: number;
  readonly outstandingMinor: number;
  readonly overdueCount: number;
};

type AttendanceSummary = {
  readonly sessionDate: string;
  readonly sessionCount: number;
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

export default function AdminHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [school, setSchool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kpiError, setKpiError] = useState(false);
  const [navIds, setNavIds] = useState<ReadonlySet<AdminNavId> | null>(null);
  const [students, setStudents] = useState<StudentSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [approvals, setApprovals] = useState(headmasterProfile.pendingApprovals);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [tenant, me] = await Promise.all([
          apiRequest<TenantCurrent>('/api/v1/tenants/current', { auth }),
          apiRequest<MeEnvelope>('/api/v1/auth/me', { auth }),
        ]);
        setSchool(tenant.data.name ?? tenant.data.code ?? tenant.data.id);
        const ids = visibleAdminNavIds(me.data);
        setNavIds(ids);
        const jobs: Array<Promise<void>> = [];
        if (ids.has('students')) {
          jobs.push(
            loadOptionalSummary<StudentSummary>('/api/v1/students/summary').then((row) => {
              setStudents(row);
            }),
          );
        }
        if (ids.has('fees')) {
          jobs.push(
            loadOptionalSummary<InvoiceSummary>('/api/v1/invoices/summary').then((row) => {
              setInvoices(row);
            }),
          );
        }
        if (ids.has('attendance')) {
          jobs.push(
            loadOptionalSummary<AttendanceSummary>('/api/v1/attendance-sessions/summary').then(
              (row) => {
                setAttendance(row);
              },
            ),
          );
        }
        const settled = await Promise.allSettled(jobs);
        setKpiError(settled.some((item) => item.status === 'rejected'));
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'tenant'));
        else setError('Could not load school.');
      }
    })();
  }, []);

  const base = `/t/${tenantId}/admin`;
  const loading = navIds === null && error === null;
  const groups = navIds === null ? [] : groupAdminNav(navIds).filter((g) => g.id !== 'home');
  const areaCards = groups.flatMap((group) =>
    group.items
      .map((id) => ADMIN_HUB_BY_ID[id])
      .filter((card): card is AdminHubCard => card !== undefined),
  );
  const quickStarts = navIds === null ? [] : visibleAdminHubQuickStarts(navIds);
  const emptyAreas = !loading && error === null && areaCards.length === 0;
  const showKpis = students !== null || invoices !== null || attendance !== null;

  /* ── mock KPI data (used alongside real API data when available) ── */
  const { kpis } = headmasterProfile;
  const collectionPct = Math.round((kpis.feesCollectedTzs / kpis.feesTargetTzs) * 100);

  const kpiCards = [
    { label: 'Total Students', value: students ? students.total.toLocaleString() : kpis.students.toLocaleString(), icon: Users },
    { label: 'Teachers', value: String(kpis.teachers), icon: UserCheck },
    { label: 'Attendance Today', value: `${kpis.attendanceTodayPct}%`, icon: Percent },
    { label: 'Fees Collected', value: formatTzs(kpis.feesCollectedTzs), icon: Wallet },
  ];

  function decide(id: string, action: 'approve' | 'reject') {
    const item = approvals.find((a) => a.id === id);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    toast.success(
      action === 'approve'
        ? `Approved: ${item?.title ?? ''}`
        : `Rejected: ${item?.title ?? ''}`,
    );
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="animate-rise flex flex-col gap-1">
          <p className="text-sm text-[var(--muted-foreground)]">
            {headmasterProfile.name} · {school ?? '…'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('hub.title')}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {school !== null ? `${school} — ${t('hub.description')}` : t('hub.loadingSchool')}
          </p>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {kpiError ? <Banner tone="error">{t('kpi.loadError')}</Banner> : null}
        {loading ? <p className="text-sm text-[var(--muted-foreground)]">{t('hub.loadingAreas')}</p> : null}
        {emptyAreas ? <Banner tone="info">{t('hub.emptyAreas')}</Banner> : null}

        {/* ── KPI Cards ── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-[var(--border)]/80">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <CardDescription>{label}</CardDescription>
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)]">
                  <Icon aria-hidden className="size-4" />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Fee Collection Progress ── */}
        <Card className="border-[var(--border)]/80">
          <CardHeader>
            <CardTitle className="text-base">Fee Collection</CardTitle>
            <CardDescription>
              Target: {formatTzs(kpis.feesTargetTzs)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {collectionPct}%
              </p>
              <p className="text-sm text-[var(--muted-foreground)] tabular-nums">
                {formatTzs(kpis.feesCollectedTzs)}
              </p>
            </div>
            <Progress value={collectionPct} aria-label="Fee Collection" />
          </CardContent>
        </Card>

        {/* ── Pending Approvals + Alerts ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pending Approvals */}
          <Card className="border-[var(--border)]/80">
            <CardHeader>
              <CardTitle className="text-base">Pending Approvals</CardTitle>
              <CardDescription>
                {approvals.length === 0 ? '—' : `${approvals.length} waiting`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {approvals.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">All clear for now.</p>
              ) : (
                approvals.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-3">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {item.requester}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide(item.id, 'reject')}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => decide(item.id, 'approve')}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="border-[var(--border)]/80">
            <CardHeader>
              <CardTitle className="text-base">Alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {headmasterProfile.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--muted)]/25 px-3 py-3"
                >
                  <span
                    className={cn(
                      'mt-1 size-2 shrink-0 rounded-full',
                      alert.severity === 'high' && 'bg-rose-600',
                      alert.severity === 'medium' && 'bg-amber-500',
                      alert.severity === 'low' && 'bg-teal-600',
                    )}
                    aria-hidden
                  />
                  <p className="text-sm leading-snug">{alert.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Class Attendance Snapshot ── */}
        <Card className="border-[var(--border)]/80">
          <CardHeader>
            <CardTitle className="text-base">Class Attendance Snapshot</CardTitle>
            <CardDescription>Today · live roll-up</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {headmasterProfile.classAttendance.map((row) => {
              const pct = Math.round((row.present / row.total) * 100);
              return (
                <div key={row.className} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{row.className}</span>
                    <span className="flex items-center gap-2 tabular-nums text-[var(--muted-foreground)]">
                      {row.present}/{row.total}
                      <Badge
                        variant="secondary"
                        className={cn(
                          pct < 90 &&
                            'bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100',
                          pct < 85 &&
                            'bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-100',
                        )}
                      >
                        {pct}%
                      </Badge>
                    </span>
                  </div>
                  <Progress value={pct} aria-label={row.className} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Quick Starts ── */}
        {quickStarts.length > 0 ? (
          <section className="flex flex-col gap-3" aria-labelledby="admin-hub-quick-heading">
            <h2 id="admin-hub-quick-heading" className="text-sm font-semibold">
              {t('hub.quickStarts')}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {quickStarts.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${base}${item.hrefSuffix}`}
                    className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:border-[var(--primary)]/40"
                  >
                    <strong className="text-sm">{t(quickLabelKey(item.id))}</strong>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {t(quickHintKey(item.id))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Area Groups ── */}
        {!loading && !emptyAreas ? (
          <div className="flex flex-col gap-6">
            {groups.map((group) => {
              const cards = group.items
                .map((id) => ADMIN_HUB_BY_ID[id])
                .filter((card): card is AdminHubCard => card !== undefined);
              if (cards.length === 0) return null;
              return (
                <section key={group.id} className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold">{t(groupMessageKey(group.id))}</h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                      <li key={card.id}>
                        <Link
                          href={`${base}${card.hrefSuffix}`}
                          className="block h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:border-[var(--primary)]/40"
                        >
                          <strong className="text-sm">{t(navMessageKey(card.id))}</strong>
                          <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                            {t(hubBlurbKey(card.id))}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
