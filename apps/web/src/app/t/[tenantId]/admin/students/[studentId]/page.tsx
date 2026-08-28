'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { User, GraduationCap, DollarSign, Users, IdCard } from 'lucide-react';

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
import {
  resolveClassNames,
  resolveGuardianNames,
  resolveStreamNames,
} from '@/lib/admin/resolve-related-names';
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
      <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
        {/* Header / Hero */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col">
              <Link
                href={`/t/${tenantId}/admin/students`}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 mb-1 transition-colors"
              >
                ← {t('students.back')}
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight">
                {row?.displayName ?? t('students.student')}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IdCard className="h-4 w-4" />
                  {row?.studentCode ?? 'No ID'}
                </span>
                {row && <StatusChip label={row.status} />}
              </div>
            </div>
          </div>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}

        {row !== null ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Column - Activity & Records (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              {showAcademic ? (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-muted-foreground" />
                      {t('students.enrollments')}
                    </h2>
                    <Button asChild variant="outline" size="sm" className="h-8">
                      <Link href={adminEnrollmentsCreatePath(tenantId, studentId)}>
                        {t('students.createEnrollment')}
                      </Link>
                    </Button>
                  </div>
                  <Card className="overflow-hidden border shadow-sm">
                    {enrollments.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                        <GraduationCap className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        {enrollmentLoading
                          ? t('common.loading')
                          : (enrollmentError ?? t('students.noEnrollments'))}
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y">
                        {enrollments.map((enr) => (
                          <Link
                            key={enr.id}
                            href={adminEnrollmentPath(tenantId, enr.id)}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {classNames[enr.classId] ?? enr.classId}
                              </span>
                              {enr.streamId !== null ? (
                                <span className="text-sm text-muted-foreground">
                                  Stream {streamNames[enr.streamId] ?? enr.streamId}
                                </span>
                              ) : null}
                            </div>
                            <StatusChip label={enr.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                    <ResourceListPagination
                      nextCursor={enrollmentCursor}
                      loadingMore={enrollmentLoadingMore}
                      onLoadMore={() =>
                        void loadEnrollments({ cursor: enrollmentCursor, append: true })
                      }
                    />
                  </Card>
                </section>
              ) : null}

              {showFees ? (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      {t('students.fees')}
                    </h2>
                    <Button asChild variant="outline" size="sm" className="h-8">
                      <Link href={adminInvoicesCreatePath(tenantId, studentId)}>
                        {t('students.createInvoice')}
                      </Link>
                    </Button>
                  </div>
                  <Card className="overflow-hidden border shadow-sm">
                    {invoices.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                        <DollarSign className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        {invoiceLoading
                          ? t('common.loading')
                          : (invoiceError ?? t('students.noInvoices'))}
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y">
                        {invoices.map((inv) => (
                          <Link
                            key={inv.id}
                            href={adminInvoicePath(tenantId, inv.id)}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {invoiceStatusLabel(inv.status)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {t('students.balance')}{' '}
                                <strong className="text-foreground">
                                  {formatTzsMinor(inv.balanceMinor)}
                                </strong>
                                <span className="mx-2 opacity-50">·</span>
                                {t('students.total')} {formatTzsMinor(inv.totalMinor)}
                              </span>
                            </div>
                            <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                              →
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    <ResourceListPagination
                      nextCursor={invoiceCursor}
                      loadingMore={invoiceLoadingMore}
                      onLoadMore={() => void loadInvoices({ cursor: invoiceCursor, append: true })}
                    />
                  </Card>
                </section>
              ) : null}
            </div>

            {/* Sidebar Column - Profile & Guardians (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="flex flex-col gap-4" onSubmit={(e) => void onSave(e)}>
                    <div className="flex flex-col gap-2">
                      <Label
                        htmlFor="displayName"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {t('students.displayName')}
                      </Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={200}
                        className="h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label
                        htmlFor="studentCode"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {t('students.studentCode')}
                      </Label>
                      <Input
                        id="studentCode"
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        pattern="[A-Za-z0-9._-]{0,64}"
                        title={t('students.codeHint')}
                        className="h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label
                        htmlFor="status"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {t('common.status')}
                      </Label>
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
                    <div className="pt-2">
                      <Button type="submit" disabled={busy} className="w-full h-9">
                        {busy ? t('common.saving') : t('students.saveChanges')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {showGuardians ? (
                <Card className="border shadow-sm">
                  <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {t('students.guardians')}
                    </CardTitle>
                    <Link
                      href={`/t/${tenantId}/admin/guardians`}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Manage
                    </Link>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    {guardianLinks.length === 0 ? (
                      <div className="px-6 pb-6 text-sm text-muted-foreground text-center">
                        {guardianLoading
                          ? t('common.loading')
                          : (guardianError ?? t('students.noGuardians'))}
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y">
                        {guardianLinks.map((link) => (
                          <Link
                            key={link.id}
                            href={adminGuardianPath(tenantId, link.guardianId)}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                {guardianNames[link.guardianId] ?? link.guardianId}
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {link.relationshipType} {link.isPrimary ? '· Primary' : ''}
                              </span>
                            </div>
                            <User className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        ) : error === null ? (
          <div className="py-12 flex justify-center text-muted-foreground animate-pulse">
            {t('common.loading')}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
