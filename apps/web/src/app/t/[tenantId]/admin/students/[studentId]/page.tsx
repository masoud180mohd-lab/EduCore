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
      setInfo('Student updated.');
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
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/students`}>← Students</Link>
      </p>
      <AdminPageHeader title={row?.displayName ?? 'Student'} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {row !== null ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>Student code (optional)</span>
              <input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                pattern="[A-Za-z0-9._-]{0,64}"
                title="Letters, numbers, . _ - up to 64 characters"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {showAcademic ? (
            <RelatedRecordsSection
              title="Enrollments"
              loading={enrollmentLoading}
              error={enrollmentError}
              emptyMessage="No enrollments yet for this student."
              isEmpty={enrollments.length === 0}
              createHref={adminEnrollmentsCreatePath(tenantId, studentId)}
              createLabel="Create enrollment"
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
              <ul className="list">
                {enrollments.map((enr) => (
                  <li key={enr.id} className="card">
                    <Link href={adminEnrollmentPath(tenantId, enr.id)}>
                      <strong>{classNames[enr.classId] ?? enr.classId}</strong>
                    </Link>
                    <div className="muted">
                      <StatusChip label={enr.status} />
                      {enr.streamId !== null
                        ? ` · Stream ${streamNames[enr.streamId] ?? enr.streamId}`
                        : null}
                    </div>
                  </li>
                ))}
              </ul>
            </RelatedRecordsSection>
          ) : null}

          {showFees ? (
            <RelatedRecordsSection
              title="Fees"
              loading={invoiceLoading}
              error={invoiceError}
              emptyMessage="No invoices yet for this student."
              isEmpty={invoices.length === 0}
              createHref={adminInvoicesCreatePath(tenantId, studentId)}
              createLabel="Create invoice"
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
              <ul className="list">
                {invoices.map((inv) => (
                  <li key={inv.id} className="card">
                    <Link href={adminInvoicePath(tenantId, inv.id)}>
                      <strong>{invoiceStatusLabel(inv.status)}</strong>
                    </Link>
                    <div className="muted">
                      Balance {formatTzsMinor(inv.balanceMinor)} · Total{' '}
                      {formatTzsMinor(inv.totalMinor)}
                    </div>
                  </li>
                ))}
              </ul>
            </RelatedRecordsSection>
          ) : null}

          {showGuardians ? (
            <RelatedRecordsSection
              title="Guardians"
              loading={guardianLoading}
              error={guardianError}
              emptyMessage="No active guardian links for this student."
              isEmpty={guardianLinks.length === 0}
              createHref={`/t/${tenantId}/admin/guardians`}
              createLabel="Guardians directory"
            >
              <ul className="list">
                {guardianLinks.map((link) => (
                  <li key={link.id} className="card">
                    <Link href={adminGuardianPath(tenantId, link.guardianId)}>
                      <strong>{guardianNames[link.guardianId] ?? link.guardianId}</strong>
                    </Link>
                    <div className="muted">
                      {link.relationshipType}
                      {link.isPrimary ? ' · primary' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </RelatedRecordsSection>
          ) : null}
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
