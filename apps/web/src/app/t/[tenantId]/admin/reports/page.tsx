'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  Printer,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { formatTzsMinor } from '@/lib/finance/money';

type StudentSummary = {
  total: number;
  active: number;
  other: number;
};

/** Server-side aggregate from GET /api/v1/invoices/summary — never re-derive money client-side. */
type InvoiceSummary = {
  readonly collectedMinor: number;
};

type CountedPage = {
  readonly data: ReadonlyArray<unknown>;
  readonly page: { readonly nextCursor: string | null };
};

type ReportsStats = {
  activeStudents: number;
  collectedFeesMinor: number;
  totalExams: number | null;
  totalExamsCapped: boolean;
  totalClasses: number | null;
  totalClassesCapped: boolean;
};

const EMPTY_STATS: ReportsStats = {
  activeStudents: 0,
  collectedFeesMinor: 0,
  totalExams: null,
  totalExamsCapped: false,
  totalClasses: null,
  totalClassesCapped: false,
};

/**
 * Count a paginated list without silently truncating: when a next cursor
 * exists the list was capped, so the card discloses "N+" instead of a false
 * exact total (cursor pagination carries no meta.total).
 */
function countFromPage(result: PromiseSettledResult<CountedPage>): {
  count: number | null;
  capped: boolean;
} {
  if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) {
    return { count: null, capped: false };
  }
  const capped = result.value.page?.nextCursor != null;
  return { count: result.value.data.length, capped };
}

function formatCount(count: number | null, capped: boolean): string {
  if (count === null) return '—';
  return capped ? `${String(count)}+` : String(count);
}

export default function AdminReportsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  const [stats, setStats] = useState<ReportsStats>(EMPTY_STATS);
  const [kpiError, setKpiError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [stuRes, invRes, exRes, clRes] = await Promise.allSettled([
        apiRequest<{ data: StudentSummary }>('/api/v1/students/summary', { auth }),
        apiRequest<{ data: InvoiceSummary }>('/api/v1/invoices/summary', { auth }),
        apiRequest<CountedPage>('/api/v1/exams?limit=100', { auth }),
        apiRequest<CountedPage>('/api/v1/classes?limit=100', { auth }),
      ]);

      // Money and student counts come from server-side aggregates over the
      // full dataset — the invoice list itself must never be summed here.
      const activeStudents =
        stuRes.status === 'fulfilled' && stuRes.value.data ? stuRes.value.data.active : 0;
      const collectedFees =
        invRes.status === 'fulfilled' && invRes.value.data ? invRes.value.data.collectedMinor : 0;

      const exams = countFromPage(exRes);
      const classes = countFromPage(clRes);

      setStats({
        activeStudents,
        collectedFeesMinor: collectedFees,
        totalExams: exams.count,
        totalExamsCapped: exams.capped,
        totalClasses: classes.count,
        totalClassesCapped: classes.capped,
      });
      setKpiError(stuRes.status === 'rejected' || invRes.status === 'rejected');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const reportCategories = [
    {
      title: 'Ripoti ya Usajili wa Wanafunzi (Student Demographics)',
      description:
        'Orodha ya wanafunzi waliosajiliwa, madarasa, mikondo, na mawasiliano ya wazazi wao.',
      href: `${base}/students`,
      icon: GraduationCap,
      accent: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: 'Usajili & Wanafunzi',
    },
    {
      title: 'Ripoti ya Mahudhurio (Attendance Analytics)',
      description:
        'Takwimu za mahudhurio ya kila siku, viwango vya utoro, na rekodi za madarasa yote.',
      href: `${base}/attendance`,
      icon: CalendarCheck,
      accent:
        'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'Mahudhurio',
    },
    {
      title: 'Ripoti ya Mapato na Ada (Financial Statements)',
      description:
        'Taarifa za makusanyo ya ada, ankara zilizolipwa, madeni yaliyobaki, na stakabadhi za fedha.',
      href: `${base}/fees/invoices`,
      icon: Wallet,
      accent:
        'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Fedha & Ada',
    },
    {
      title: 'Ripoti ya Mitihani na Ufaulu (Exam Performance)',
      description:
        'Uchambuzi wa alama za mitihani, wastani wa masomo, na madaraja ya madarasa yote.',
      href: `${base}/exams`,
      icon: Award,
      accent:
        'from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badge: 'Kitaaluma & Mitihani',
    },
    {
      title: 'Kadi za Matokeo za Wanafunzi (Report Cards)',
      description:
        'Kadi rasmi za matokeo ya mitihani ya wanafunzi zikiwa na maoni ya walimu na daraja la jumla.',
      href: `${base}/report-cards`,
      icon: FileSpreadsheet,
      accent: 'from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: 'Report Cards',
    },
    {
      title: 'Ripoti ya Muundo wa Kitaaluma (Academic Structure)',
      description:
        'Takwimu za miaka ya masomo, mihula, masomo yanayofundishwa, na idadi ya mikondo.',
      href: `${base}/academic`,
      icon: BookOpen,
      accent: 'from-cyan-500/10 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      badge: 'Muundo wa Shule',
    },
  ];

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Link href={`/t/${tenantId}/admin`} className="hover:underline text-primary">
                ← {t('common.admin')}
              </Link>
            </p>
            <AdminPageHeader
              title={t('page.reports.title')}
              description="Kituo kikuu cha uchambuzi na uzalishaji wa ripoti za kitaaluma, fedha, na mahudhurio ya shule."
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Chapisha (Print)
            </Button>
          </div>
        </div>

        {/* Live Institutional KPI Cards */}
        {kpiError ? <Banner tone="error">{t('kpi.loadError')}</Banner> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Wanafunzi Wanaosoma
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                  {loading ? '…' : stats.activeStudents}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Makusanyo ya Ada
                </p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                  {loading ? '…' : formatTzsMinor(stats.collectedFeesMinor)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mitihani Iliyopo
                </p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums mt-1">
                  {loading ? '…' : formatCount(stats.totalExams, stats.totalExamsCapped)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Award className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Madarasa Yaliyopo
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
                  {loading ? '…' : formatCount(stats.totalClasses, stats.totalClassesCapped)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <BookOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bento Grid Report Categories */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportCategories.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.title}
                href={report.href}
                className="group block focus:outline-none"
              >
                <Card className="h-full border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {report.badge}
                      </span>
                      <CardTitle className="text-base font-bold group-hover:text-primary transition-colors mt-2">
                        {report.title}
                      </CardTitle>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-gradient-to-br ${report.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                      {report.description}
                    </CardDescription>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
                      <span className="font-semibold text-primary group-hover:underline">
                        Tazama Ripoti
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
