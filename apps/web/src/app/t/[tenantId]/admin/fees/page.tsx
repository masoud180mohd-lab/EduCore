'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { canFinanceReconcile } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { formatTzsMinor } from '@/lib/finance/money';

type MeEnvelope = { readonly data: MeLike };

type SyncPendingResult = {
  readonly scanned: number;
  readonly completed: number;
  readonly results: ReadonlyArray<{
    readonly paymentAttemptId: string;
    readonly providerStatus: string;
    readonly completed: boolean;
    readonly detail: string;
  }>;
};

type InvoiceRow = {
  readonly id: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly status: string;
};

type FinanceStats = {
  totalInvoicedMinor: number;
  totalBalanceMinor: number;
  totalCollectedMinor: number;
  invoicesCount: number;
  structuresCount: number;
  receiptsCount: number;
};

const FAKE_PROVIDER_BANNER =
  'Collect fees at the office (cash, bank, or cheque). Mobile money waits until a ClickPesa account exists (PAY-007).';

export default function AdminFeesHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin/fees`;

  const [canReconcile, setCanReconcile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [stats, setStats] = useState<FinanceStats>({
    totalInvoicedMinor: 0,
    totalBalanceMinor: 0,
    totalCollectedMinor: 0,
    invoicesCount: 0,
    structuresCount: 0,
    receiptsCount: 0,
  });

  const loadData = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [meRes, invRes, structRes, payRes] = await Promise.allSettled([
        apiRequest<MeEnvelope>('/api/v1/auth/me', { auth }),
        apiRequest<{ data: InvoiceRow[] }>('/api/v1/invoices?limit=100', { auth }),
        apiRequest<{ data: unknown[] }>('/api/v1/fee-structures?limit=100', { auth }),
        apiRequest<{ data: unknown[] }>('/api/v1/payments?limit=100', { auth }),
      ]);

      if (meRes.status === 'fulfilled') {
        setCanReconcile(canFinanceReconcile(meRes.value.data));
      }

      let totalInvoiced = 0;
      let totalBalance = 0;
      let invoicesCount = 0;

      if (invRes.status === 'fulfilled' && invRes.value.data) {
        const invoices = invRes.value.data;
        invoicesCount = invoices.length;
        for (const inv of invoices) {
          totalInvoiced += Number(inv.totalMinor || 0);
          totalBalance += Number(inv.balanceMinor || 0);
        }
      }

      const totalCollected = Math.max(0, totalInvoiced - totalBalance);
      const structuresCount = structRes.status === 'fulfilled' && structRes.value.data ? structRes.value.data.length : 0;
      const receiptsCount = payRes.status === 'fulfilled' && payRes.value.data ? payRes.value.data.length : 0;

      setStats({
        totalInvoicedMinor: totalInvoiced,
        totalBalanceMinor: totalBalance,
        totalCollectedMinor: totalCollected,
        invoicesCount,
        structuresCount,
        receiptsCount,
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onSyncPending() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = 'payment.sync-provider-pending';
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: SyncPendingResult }>(
        '/api/v1/payments/sync-provider-pending',
        {
          method: 'POST',
          auth,
          body: { limit: 25 },
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      const data = result.data;
      setInfo(`Sync pending: scanned ${data.scanned}, completed ${data.completed}.`);
      await loadData();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 501 || err.code === 'NOT_IMPLEMENTED') {
          setError(FAKE_PROVIDER_BANNER);
        } else {
          setError(adminFriendlyMessage(err, 'finance', { action: 'reconcile' }));
        }
      } else setError('Could not sync pending payments.');
    } finally {
      setBusy(false);
    }
  }

  const sections = [
    {
      title: t('fees.structures'),
      description: t('fees.structuresHint'),
      href: `${base}/structures`,
      count: stats.structuresCount,
      icon: Layers,
      accent: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: 'Miundo ya Ada',
    },
    {
      title: t('fees.invoices'),
      description: t('fees.invoicesHint'),
      href: `${base}/invoices`,
      count: stats.invoicesCount,
      icon: FileText,
      accent: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Ankara za Wanafunzi',
    },
    {
      title: t('fees.receipts'),
      description: t('fees.receiptsHint'),
      href: `${base}/receipts`,
      count: stats.receiptsCount,
      icon: Receipt,
      accent: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'Stakabadhi & Malipo',
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
            <AdminPageHeader title={t('fees.title')} description={t('fees.description')} />
          </div>

          <div className="flex items-center gap-2">
            {canReconcile && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void onSyncPending()}
                title={t('fees.syncTitle')}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                {busy ? t('fees.syncing') : t('fees.syncPending')}
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={`${base}/invoices`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Ankara Mpya
              </Link>
            </Button>
          </div>
        </div>

        {error !== null && <Banner tone="error">{error}</Banner>}
        {info !== null && <Banner tone="info">{info}</Banner>}
        <Banner tone="info">{t('fees.officeBanner')}</Banner>

        {/* Financial KPI Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Jumla ya Ankara (Invoiced)
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-1">
                  {loading ? '…' : formatTzsMinor(stats.totalInvoicedMinor)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Makusanyo (Collected)
                </p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                  {loading ? '…' : formatTzsMinor(stats.totalCollectedMinor)}
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
                  Deni Linalobaki (Outstanding)
                </p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                  {loading ? '…' : formatTzsMinor(stats.totalBalanceMinor)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bento Grid layout */}
        <div className="grid gap-4 sm:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href} className="group block focus:outline-none">
                <Card className="h-full border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {section.badge}
                        </span>
                      </div>
                      <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">
                        {section.title}
                      </CardTitle>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-gradient-to-br ${section.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                      {section.description}
                    </CardDescription>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
                      <span>
                        <strong className="text-sm font-bold text-foreground tabular-nums">
                          {loading ? '…' : section.count}
                        </strong>{' '}
                        rekodi
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
