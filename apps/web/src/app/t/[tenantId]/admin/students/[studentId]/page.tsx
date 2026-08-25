'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  Banner,
  RelatedRecordsSection,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  adminEnrollmentsCreatePath,
  adminEnrollmentPath,
  adminGuardianPath,
  adminInvoicePath,
  adminInvoicesCreatePath,
} from '@/lib/admin/admin-paths';
import {
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { resolveClassNames, resolveGuardianNames, resolveStreamNames } from '@/lib/admin/resolve-related-names';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { visibleAdminNavIds } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type EnrollmentRow } from '@/lib/academic/types';
import { invoiceStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';
import { type StudentRow, type StudentStatus, STUDENT_STATUSES } from '@/lib/students/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

const RELATED_LIST_LIMIT = 25;

type InvoiceSummaryRow = {
  readonly id: string;
  readonly status: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
};

type StudentGuardianLink = {
  readonly id: string;
  readonly guardianId: string;
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
};

type MeEnvelope = { readonly data: MeLike };

export default function AdminStudentDetailPage() {
  const params = useParams<{ tenantId: string; studentId: string }>();
  const { tenantId, studentId } = params;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [status, setStatus] = useState<StudentStatus>('active');

  const [showAcademic, setShowAcademic] = useState(false);
  const [showFees, setShowFees] = useState(false);
  const [showGuardians, setShowGuardians] = useState(false);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [enrollmentCursor, setEnrollmentCursor] = useState<string | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentLoadingMore, setEnrollmentLoadingMore] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [streamNames, setStreamNames] = useState<Record<string, string>>({});

  const [invoices, setInvoices] = useState<InvoiceSummaryRow[]>([]);
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceLoadingMore, setInvoiceLoadingMore] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [guardianLinks, setGuardianLinks] = useState<StudentGuardianLink[]>([]);
  const [guardianNames, setGuardianNames] = useState<Record<string, string>>({});
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: StudentRow }>(`/api/v1/students/${studentId}`, {
        auth,
      });
      setRow(result.data);
      setDisplayName(result.data.displayName);
      setStudentCode(result.data.studentCode ?? '');
      setStatus(result.data.status as StudentStatus);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError('Could not load student.');
    }
  }, [studentId]);

  const loadEnrollments = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setEnrollmentLoadingMore(true);
      else setEnrollmentLoading(true);
      try {
        const q = buildListQuery('/api/v1/enrollments', {
          limit: RELATED_LIST_LIMIT,
          cursor: opts.cursor,
          filters: { studentId },
        });
        const result = await apiRequest<PaginatedEnvelope<EnrollmentRow>>(q, { auth });
        const page = readPageMeta(result);
        const rows = result.data ?? [];
        setEnrollments((prev) => (opts.append ? appendById(prev, rows) : [...rows]));
        setEnrollmentCursor(page.nextCursor);
        const names = await resolveClassNames(
          auth,
          rows.map((r) => r.classId),
        );
        setClassNames((prev) => ({ ...prev, ...names }));
        const streams = await resolveStreamNames(
          auth,
          rows.map((r) => r.streamId).filter((id): id is string => id !== null && id !== ''),
        );
        setStreamNames((prev) => ({ ...prev, ...streams }));
        setEnrollmentError(null);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setEnrollmentError(adminFriendlyMessage(err, 'academic'));
        } else setEnrollmentError('Could not load enrollments.');
        if (!opts.append) setEnrollments([]);
      } finally {
        setEnrollmentLoading(false);
        setEnrollmentLoadingMore(false);
      }
    },
    [studentId],
  );

  const loadInvoices = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setInvoiceLoadingMore(true);
      else setInvoiceLoading(true);
      try {
        const q = buildListQuery('/api/v1/invoices', {
          limit: RELATED_LIST_LIMIT,
          cursor: opts.cursor,
          filters: { studentId },
        });
        const result = await apiRequest<PaginatedEnvelope<InvoiceSummaryRow>>(q, { auth });
        const page = readPageMeta(result);
        setInvoices((prev) =>
          opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
        );
        setInvoiceCursor(page.nextCursor);
        setInvoiceError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setInvoiceError(adminFriendlyMessage(err, 'finance'));
        else setInvoiceError('Could not load invoices.');
        if (!opts.append) setInvoices([]);
      } finally {
        setInvoiceLoading(false);
        setInvoiceLoadingMore(false);
      }
    },
    [studentId],
  );

  const loadGuardians = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setGuardianLoading(true);
    try {
      const result = await apiRequest<{ data: StudentGuardianLink[] }>(
        `/api/v1/students/${studentId}/guardians`,
        { auth },
      );
      const active = (result.data ?? []).filter((link) => link.status === 'active');
      setGuardianLinks(active);
      const names = await resolveGuardianNames(
        auth,
        active.map((link) => link.guardianId),
      );
      setGuardianNames(names);
      setGuardianError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setGuardianError(adminFriendlyMessage(err, 'guardians'));
      else setGuardianError('Could not load guardian links.');
      setGuardianLinks([]);
    } finally {
      setGuardianLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth });
        const navIds = visibleAdminNavIds(me.data);
        const academic = navIds.has('academic');
        const fees = navIds.has('fees');
        const guardians = navIds.has('guardians');
        setShowAcademic(academic);
        setShowFees(fees);
        setShowGuardians(guardians);
        if (academic) void loadEnrollments({ cursor: null, append: false });
        if (fees) void loadInvoices({ cursor: null, append: false });
        if (guardians) void loadGuardians();
      } catch {
        // Shell gate handles denied access; sections stay hidden.
      }
    })();
  }, [loadEnrollments, loadInvoices, loadGuardians]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `student.patch:${studentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: StudentRow }>(`/api/v1/students/${studentId}`, {
        method: 'PATCH',
        auth,
        body: {
          displayName: displayName.trim(),
          studentCode: studentCode.trim() === '' ? null : studentCode.trim(),
          status,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo(t('students.updated'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError('Could not update student.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/t/${tenantId}/admin/students`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {t('students.back')}
          </Link>
          <div className="mt-2">
            <AdminPageHeader title={row?.displayName ?? t('students.student')} />
          </div>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}

        {row !== null ? (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('students.student')}</CardTitle>
                <CardDescription>{row.studentCode ?? 'No student code assigned'}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4 max-w-md" onSubmit={(e) => void onSave(e)}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="displayName">{t('students.displayName')}</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="studentCode">{t('students.studentCode')}</Label>
                    <Input
                      id="studentCode"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      pattern="[A-Za-z0-9._-]{0,64}"
                      title={t('students.codeHint')}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="status">{t('common.status')}</Label>
                    <select
                      id="status"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as StudentStatus)}
                    >
                      {STUDENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Button type="submit" disabled={busy}>
                      {busy ? t('common.saving') : t('students.saveChanges')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {showAcademic ? (
              <RelatedRecordsSection
                title={t('students.enrollments')}
                loading={enrollmentLoading}
                error={enrollmentError}
                emptyMessage={t('students.noEnrollments')}
                isEmpty={enrollments.length === 0}
                createHref={adminEnrollmentsCreatePath(tenantId, studentId)}
                createLabel={t('students.createEnrollment')}
                footer={
                  <ResourceListPagination
                    nextCursor={enrollmentCursor}
                    loadingMore={enrollmentLoadingMore}
                    onLoadMore={() => {
                      void loadEnrollments({ cursor: enrollmentCursor, append: true });
                    }}
                  />
                }
              >
                <ul className="flex flex-col gap-2">
                  {enrollments.map((enr) => (
                    <li key={enr.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Link
                          href={adminEnrollmentPath(tenantId, enr.id)}
                          className="text-sm font-semibold hover:underline text-primary"
                        >
                          {classNames[enr.classId] ?? enr.classId}
                        </Link>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <StatusChip label={enr.status} />
                          {enr.streamId !== null
                            ? `· Stream ${streamNames[enr.streamId] ?? enr.streamId}`
                            : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </RelatedRecordsSection>
            ) : null}

            {showFees ? (
              <RelatedRecordsSection
                title={t('students.fees')}
                loading={invoiceLoading}
                error={invoiceError}
                emptyMessage={t('students.noInvoices')}
                isEmpty={invoices.length === 0}
                createHref={adminInvoicesCreatePath(tenantId, studentId)}
                createLabel={t('students.createInvoice')}
                footer={
                  <ResourceListPagination
                    nextCursor={invoiceCursor}
                    loadingMore={invoiceLoadingMore}
                    onLoadMore={() => {
                      void loadInvoices({ cursor: invoiceCursor, append: true });
                    }}
                  />
                }
              >
                <ul className="flex flex-col gap-2">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Link
                          href={adminInvoicePath(tenantId, inv.id)}
                          className="text-sm font-semibold hover:underline text-primary"
                        >
                          {invoiceStatusLabel(inv.status)}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('students.balance')} {formatTzsMinor(inv.balanceMinor)} · {t('students.total')}{' '}
                          {formatTzsMinor(inv.totalMinor)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </RelatedRecordsSection>
            ) : null}

            {showGuardians ? (
              <RelatedRecordsSection
                title={t('students.guardians')}
                loading={guardianLoading}
                error={guardianError}
                emptyMessage={t('students.noGuardians')}
                isEmpty={guardianLinks.length === 0}
                createHref={`/t/${tenantId}/admin/guardians`}
                createLabel={t('students.guardiansDirectory')}
              >
                <ul className="flex flex-col gap-2">
                  {guardianLinks.map((link) => (
                    <li key={link.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Link
                          href={adminGuardianPath(tenantId, link.guardianId)}
                          className="text-sm font-semibold hover:underline text-primary"
                        >
                          {guardianNames[link.guardianId] ?? link.guardianId}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                          {link.relationshipType}
                          {link.isPrimary ? ' · primary' : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </RelatedRecordsSection>
            ) : null}
          </div>
        ) : error === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
