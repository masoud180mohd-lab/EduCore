'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
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

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('hub.title')}
        description={
          school !== null ? `${school} — ${t('hub.description')}` : t('hub.loadingSchool')
        }
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {kpiError ? <Banner tone="error">{t('kpi.loadError')}</Banner> : null}
      {loading ? <p className="muted">{t('hub.loadingAreas')}</p> : null}
      {emptyAreas ? <Banner tone="info">{t('hub.emptyAreas')}</Banner> : null}

      {showKpis ? (
        <ul className="kpi-grid" aria-label={t('common.dashboard')}>
          {students !== null ? (
            <li className="kpi-tile">
              <div className="kpi-tile-label">{t('kpi.students')}</div>
              <div className="kpi-tile-value">{students.total}</div>
              <div className="kpi-tile-meta">{t('kpi.staffHint')}</div>
            </li>
          ) : null}
          {invoices !== null ? (
            <>
              <li className="kpi-tile">
                <div className="kpi-tile-label">{t('kpi.collected')}</div>
                <div className="kpi-tile-value">{formatTzsMinor(invoices.collectedMinor)}</div>
              </li>
              <li className="kpi-tile">
                <div className="kpi-tile-label">{t('kpi.outstanding')}</div>
                <div className="kpi-tile-value">{formatTzsMinor(invoices.outstandingMinor)}</div>
              </li>
              <li className="kpi-tile">
                <div className="kpi-tile-label">{t('kpi.overdue')}</div>
                <div className="kpi-tile-value">{invoices.overdueCount}</div>
              </li>
            </>
          ) : null}
          {attendance !== null ? (
            <li className="kpi-tile">
              <div className="kpi-tile-label">{t('kpi.attendanceToday')}</div>
              <div className="kpi-tile-value">{attendance.present}</div>
              <div className="kpi-tile-meta">
                {t('kpi.present')} {attendance.present} · {t('kpi.absent')} {attendance.absent} ·{' '}
                {t('kpi.late')} {attendance.late} · {t('kpi.excused')} {attendance.excused}
              </div>
            </li>
          ) : null}
        </ul>
      ) : null}

      {quickStarts.length > 0 ? (
        <section className="admin-hub-quick" aria-labelledby="admin-hub-quick-heading">
          <h2 id="admin-hub-quick-heading" className="admin-hub-group-label">
            {t('hub.quickStarts')}
          </h2>
          <ul className="list admin-hub-quick-list">
            {quickStarts.map((item) => (
              <li key={item.id}>
                <Link className="card" href={`${base}${item.hrefSuffix}`}>
                  <strong>{t(quickLabelKey(item.id))}</strong>
                  <div className="muted">{t(quickHintKey(item.id))}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !emptyAreas ? (
        <ul className="admin-hub-groups">
          {groups.map((group) => {
            const cards = group.items
              .map((id) => ADMIN_HUB_BY_ID[id])
              .filter((card): card is AdminHubCard => card !== undefined);
            if (cards.length === 0) return null;
            return (
              <li key={group.id} className="admin-hub-group">
                <h2 className="admin-hub-group-label">{t(groupMessageKey(group.id))}</h2>
                <ul className="list">
                  {cards.map((card) => (
                    <li key={card.id}>
                      <Link className="card" href={`${base}${card.hrefSuffix}`}>
                        <strong>{t(navMessageKey(card.id))}</strong>
                        <div className="muted">{t(hubBlurbKey(card.id))}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AdminShell>
  );
}
