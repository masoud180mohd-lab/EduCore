'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { missingNameIds, resolveStudentNames } from '@/lib/admin/resolve-related-names';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { invoiceStatusLabel, INVOICE_LIST_STATUSES, type InvoiceListStatus } from '@/lib/finance/invoice-actions';
import { formatTzsMinor, parseMajorToMinor } from '@/lib/finance/money';

type InvoiceRow = {
  readonly id: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly feeStructureId: string | null;
  readonly status: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
};

type StudentRow = { readonly id: string; readonly displayName: string };
type AcademicYearRow = { readonly id: string; readonly name: string };
type FeeStructureRow = {
  readonly id: string;
  readonly name: string;
  readonly academicYearId: string;
  readonly status: string;
};
type FeeStructureItem = {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
};

export default function AdminInvoicesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsCursor, setStudentsCursor] = useState<string | null>(null);
  const [loadingMoreStudents, setLoadingMoreStudents] = useState(false);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [structuresCursor, setStructuresCursor] = useState<string | null>(null);
  const [loadingMoreStructures, setLoadingMoreStructures] = useState(false);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const studentNamesRef = useRef(studentNames);
  studentNamesRef.current = studentNames;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lineAmountMajor, setLineAmountMajor] = useState('');

  const [statusFilter, setStatusFilter] = useState<'' | InvoiceListStatus>('');
  const [studentFilter, setStudentFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<'' | InvoiceListStatus>('');
  const [appliedStudentId, setAppliedStudentId] = useState('');
  const [appliedYearId, setAppliedYearId] = useState('');

  async function loadStudentPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreStudents(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<StudentRow>>(
        buildListQuery('/api/v1/students', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setStudents((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setStudentsCursor(page.nextCursor);
      setStudentNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const s of list) next[s.id] = s.displayName;
        return next;
      });
    } catch {
      if (!opts.append) {
        setStudents([]);
        setStudentsCursor(null);
      }
    } finally {
      setLoadingMoreStudents(false);
    }
  }

  async function loadYearPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreYears(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<AcademicYearRow>>(
        buildListQuery('/api/v1/academic-years', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setYears((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setYearsCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setYears([]);
        setYearsCursor(null);
      }
    } finally {
      setLoadingMoreYears(false);
    }
  }

  async function loadStructurePicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreStructures(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<FeeStructureRow>>(
        buildListQuery('/api/v1/fee-structures', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setStructures((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setStructuresCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setStructures([]);
        setStructuresCursor(null);
      }
    } finally {
      setLoadingMoreStructures(false);
    }
  }

  async function loadPage(opts: {
    readonly statusQ: '' | InvoiceListStatus;
    readonly studentIdQ: string;
    readonly yearIdQ: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/invoices', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          status: opts.statusQ === '' ? undefined : opts.statusQ,
          studentId: opts.studentIdQ === '' ? undefined : opts.studentIdQ,
          academicYearId: opts.yearIdQ === '' ? undefined : opts.yearIdQ,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<InvoiceRow>>(q, { auth });
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setRows((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setNextCursor(page.nextCursor);
      setError(null);
      const miss = missingNameIds(
        list.map((inv) => inv.studentId),
        studentNamesRef.current,
      );
      if (miss.length > 0) {
        const names = await resolveStudentNames(auth, miss);
        setStudentNames((prev) => ({ ...prev, ...names }));
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load invoices.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadStudentPicker({ cursor: null, append: false });
    void loadYearPicker({ cursor: null, append: false });
    void loadStructurePicker({ cursor: null, append: false });
    void loadPage({
      statusQ: '',
      studentIdQ: '',
      yearIdQ: '',
      cursor: null,
      append: false,
    });
  }, []);

  useEffect(() => {
    if (prefillApplied.current) return;
    const raw = searchParams.get('studentId')?.trim() ?? '';
    if (raw === '') return;
    prefillApplied.current = true;
    setStudentId(raw);
    setStudentFilter(raw);
    setAppliedStudentId(raw);
    void loadPage({
      statusQ: '',
      studentIdQ: raw,
      yearIdQ: '',
      cursor: null,
      append: false,
    });
    void (async () => {
      const auth = readSession();
      if (auth === null) return;
      try {
        const st = await apiRequest<{ data: StudentRow }>(`/api/v1/students/${raw}`, { auth });
        setStudents((prev) => appendById(prev, [st.data]));
        setStudentNames((prev) => ({ ...prev, [st.data.id]: st.data.displayName }));
      } catch {
        /* select still holds UUID until picker catches up */
      }
    })();
  }, [searchParams]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;

    let lines: Array<{
      description: string;
      amountMinor: number;
      feeStructureItemId?: string;
    }> = [];

    if (feeStructureId !== '') {
      try {
        const detail = await apiRequest<{
          data: { items: ReadonlyArray<FeeStructureItem> };
        }>(`/api/v1/fee-structures/${feeStructureId}`, { auth });
        const items = detail.data.items ?? [];
        if (items.length === 0) {
          setError('Selected fee structure has no items.');
          return;
        }
        lines = items.map((item) => ({
          description: item.name,
          amountMinor: item.amountMinor,
          feeStructureItemId: item.id,
        }));
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
        else setError('Could not load fee structure items.');
        return;
      }
    } else {
      const desc = lineDescription.trim();
      const amountMinor = parseMajorToMinor(lineAmountMajor);
      if (desc === '' || amountMinor === null) {
        setError('Enter a line description and valid TZS amount, or pick a fee structure.');
        return;
      }
      lines = [{ description: desc, amountMinor }];
    }

    setBusy(true);
    setError(null);
    const actionKey = `invoice.create:${studentId}:${academicYearId}:${feeStructureId || lineDescription}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, unknown> = {
        studentId,
        academicYearId,
        lines,
      };
      if (feeStructureId !== '') body['feeStructureId'] = feeStructureId;

      const created = await apiRequest<{ data: InvoiceRow }>('/api/v1/invoices', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setLineDescription('');
      setLineAmountMajor('');
      setFeeStructureId('');
      router.push(`/t/${tenantId}/admin/fees/invoices/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not create invoice.');
    } finally {
      setBusy(false);
    }
  }

  const filteredStructures = structures.filter(
    (s) => academicYearId === '' || s.academicYearId === academicYearId,
  );

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees`}>← Fees</Link>
      </p>
      <AdminPageHeader
        title="Invoices"
        description="Draft and issued student invoices. Balance is derived (read-only)."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">Create draft invoice</h2>
        <div className="field">
          <label htmlFor="inv-student">Student</label>
          <select
            id="inv-student"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={studentsCursor}
            loadingMore={loadingMoreStudents}
            onLoadMore={() => {
              void loadStudentPicker({ cursor: studentsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="inv-year">Academic year</label>
          <select
            id="inv-year"
            required
            value={academicYearId}
            onChange={(e) => {
              setAcademicYearId(e.target.value);
              setFeeStructureId('');
            }}
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={yearsCursor}
            loadingMore={loadingMoreYears}
            onLoadMore={() => {
              void loadYearPicker({ cursor: yearsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="inv-structure">Fee structure (optional)</label>
          <select
            id="inv-structure"
            value={feeStructureId}
            onChange={(e) => setFeeStructureId(e.target.value)}
          >
            <option value="">Manual line only</option>
            {filteredStructures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={structuresCursor}
            loadingMore={loadingMoreStructures}
            onLoadMore={() => {
              void loadStructurePicker({ cursor: structuresCursor, append: true });
            }}
          />
        </div>
        {feeStructureId === '' ? (
          <>
            <div className="field">
              <label htmlFor="inv-line-desc">Line description</label>
              <input
                id="inv-line-desc"
                value={lineDescription}
                onChange={(e) => setLineDescription(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-line-amt">Amount (TZS major)</label>
              <input
                id="inv-line-amt"
                inputMode="decimal"
                placeholder="e.g. 50000.00"
                value={lineAmountMajor}
                onChange={(e) => setLineAmountMajor(e.target.value)}
              />
            </div>
          </>
        ) : (
          <p className="muted">Lines will be copied from the selected structure items.</p>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || studentId === '' || academicYearId === ''}
        >
          {busy ? 'Saving…' : 'Create draft'}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedStatus(statusFilter);
          setAppliedStudentId(studentFilter);
          setAppliedYearId(yearFilter);
          void loadPage({
            statusQ: statusFilter,
            studentIdQ: studentFilter,
            yearIdQ: yearFilter,
            cursor: null,
            append: false,
          });
        }}
      >
        <h2 className="section-title">Filter invoices</h2>
        <div className="field">
          <label htmlFor="list-status">Status</label>
          <select
            id="list-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | InvoiceListStatus)}
          >
            <option value="">All statuses</option>
            {INVOICE_LIST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {invoiceStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="list-student">Student</label>
          <select
            id="list-student"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          >
            <option value="">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="list-year">Academic year</label>
          <select
            id="list-year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading || loadingMore}>
          Apply filters
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No invoices yet."
        isEmpty={rows.length === 0}
        variant="table"
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                statusQ: appliedStatus,
                studentIdQ: appliedStudentId,
                yearIdQ: appliedYearId,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        <AdminTable caption="Invoices" headers={['Student', 'Status', 'Total', 'Balance', '']}>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/fees/invoices/${inv.id}`}>
                  {studentNames[inv.studentId] ?? inv.studentId}
                </Link>
              </td>
              <td>
                <StatusChip label={invoiceStatusLabel(inv.status)} />
              </td>
              <td className="muted">{formatTzsMinor(inv.totalMinor)}</td>
              <td>{formatTzsMinor(inv.balanceMinor)}</td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/fees/invoices/${inv.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
