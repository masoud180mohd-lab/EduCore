'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { invoiceStatusLabel } from '@/lib/finance/invoice-actions';
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

const STUDENT_PICKER_LIMIT = 100;

function financeMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have finance access.';
  return teacherFriendlyMessage(err);
}

export default function AdminInvoicesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lineAmountMajor, setLineAmountMajor] = useState('');

  async function loadPickers() {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [stRes, yrRes, fsRes] = await Promise.all([
        apiRequest<{ data: StudentRow[] }>(
          buildListQuery('/api/v1/students', { limit: STUDENT_PICKER_LIMIT }),
          { auth },
        ),
        apiRequest<{ data: AcademicYearRow[] }>(
          buildListQuery('/api/v1/academic-years', { limit: ADMIN_LIST_DEFAULT_LIMIT }),
          { auth },
        ),
        apiRequest<{ data: FeeStructureRow[] }>(
          buildListQuery('/api/v1/fee-structures', { limit: ADMIN_LIST_DEFAULT_LIMIT }),
          { auth },
        ),
      ]);
      const studentList = stRes.data ?? [];
      setStudents(studentList);
      setYears(yrRes.data ?? []);
      setStructures(fsRes.data ?? []);
      const names: Record<string, string> = {};
      for (const s of studentList) names[s.id] = s.displayName;
      setStudentNames(names);
    } catch {
      // Picker failure — form still usable if list loaded
    }
  }

  async function loadPage(opts: { readonly cursor: string | null; readonly append: boolean }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/invoices', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
      });
      const result = await apiRequest<PaginatedEnvelope<InvoiceRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(financeMessage(err));
      else setError('Could not load invoices.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPickers();
    void loadPage({ cursor: null, append: false });
  }, []);

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
        if (err instanceof ApiClientError) setError(financeMessage(err));
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
      if (err instanceof ApiClientError) setError(financeMessage(err));
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
              void loadPage({ cursor: nextCursor, append: true });
            }}
          />
        }
      >
        <AdminTable caption="Invoices" headers={['Student', 'Status', 'Total', 'Balance', '']}>
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/fees/invoices/${inv.id}`}>
                  {studentNames[inv.studentId] ?? inv.studentId.slice(0, 8)}
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
