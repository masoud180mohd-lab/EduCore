'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Layers,
  Plus,
  Sparkles,
  UserCheck,
} from 'lucide-react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type AcademicCounts = {
  years: number | null;
  terms: number | null;
  classes: number | null;
  streams: number | null;
  subjects: number | null;
};

export default function AdminAcademicHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin/academic`;

  const [counts, setCounts] = useState<AcademicCounts>({
    years: null,
    terms: null,
    classes: null,
    streams: null,
    subjects: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      const auth = readSession();
      if (auth === null) return;
      setLoading(true);
      try {
        const [yearsRes, termsRes, classesRes, streamsRes, subjectsRes] = await Promise.allSettled([
          apiRequest<{ data: unknown[] }>('/api/v1/academic-years?limit=100', { auth }),
          apiRequest<{ data: unknown[] }>('/api/v1/terms?limit=100', { auth }),
          apiRequest<{ data: unknown[] }>('/api/v1/classes?limit=100', { auth }),
          apiRequest<{ data: unknown[] }>('/api/v1/streams?limit=100', { auth }),
          apiRequest<{ data: unknown[] }>('/api/v1/subjects?limit=100', { auth }),
        ]);

        setCounts({
          years: yearsRes.status === 'fulfilled' ? yearsRes.value.data.length : null,
          terms: termsRes.status === 'fulfilled' ? termsRes.value.data.length : null,
          classes: classesRes.status === 'fulfilled' ? classesRes.value.data.length : null,
          streams: streamsRes.status === 'fulfilled' ? streamsRes.value.data.length : null,
          subjects: subjectsRes.status === 'fulfilled' ? subjectsRes.value.data.length : null,
        });
      } catch {
        setError('Imeshindikana kupakia baadhi ya takwimu za kitaaluma.');
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, [tenantId]);

  const cards = [
    {
      title: t('academic.years'),
      description: t('academic.yearsBlurb'),
      href: `${base}/years`,
      count: counts.years,
      icon: Calendar,
      accent: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: 'Mwaka wa Masomo',
    },
    {
      title: t('academic.terms'),
      description: t('academic.termsBlurb'),
      href: `${base}/terms`,
      count: counts.terms,
      icon: CalendarDays,
      accent: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Mihula',
    },
    {
      title: t('academic.classes'),
      description: t('academic.classesBlurb'),
      href: `${base}/classes`,
      count: counts.classes,
      icon: GraduationCap,
      accent: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'Madarasa',
    },
    {
      title: t('academic.streams'),
      description: t('academic.streamsBlurb'),
      href: `${base}/streams`,
      count: counts.streams,
      icon: Layers,
      accent: 'from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badge: 'Mikondo',
    },
    {
      title: t('academic.subjects'),
      description: t('academic.subjectsBlurb'),
      href: `${base}/subjects`,
      count: counts.subjects,
      icon: BookOpen,
      accent: 'from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: 'Masomo',
    },
    {
      title: t('academic.enrollments'),
      description: t('academic.enrollmentsBlurb'),
      href: `${base}/enrollments`,
      count: null,
      icon: UserCheck,
      accent: 'from-cyan-500/10 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      badge: 'Wanafunzi & Madarasa',
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
              title={t('academic.title')}
              description={t('academic.description')}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/years`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Mwaka Mpya
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`${base}/classes`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Darasa Jipya
              </Link>
            </Button>
          </div>
        </div>

        {error !== null && <Banner tone="error">{error}</Banner>}

        {/* Bento Grid layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="group block focus:outline-none">
                <Card className="h-full border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {card.badge}
                        </span>
                      </div>
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                        {card.title}
                      </CardTitle>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-gradient-to-br ${card.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                      {card.description}
                    </CardDescription>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
                      <span>
                        {card.count !== null ? (
                          <strong className="text-sm font-bold text-foreground tabular-nums">
                            {loading ? '…' : card.count}
                          </strong>
                        ) : (
                          <span className="flex items-center gap-1 text-primary">
                            <Sparkles className="h-3 w-3" /> Usimamizi
                          </span>
                        )}
                        {card.count !== null && ' waliosajiliwa'}
                      </span>
                      <span className="flex items-center gap-0.5 font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Fungua <ChevronRight className="h-3.5 w-3.5" />
                      </span>
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
