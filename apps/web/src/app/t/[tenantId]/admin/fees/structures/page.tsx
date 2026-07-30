'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { ResourceList, ResourceListPagination } from '@/components/admin';
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
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { parseMajorToMinor } from '@/lib/finance/money';

type FeeStructureRow = {
  readonly id: string;
  readonly name: string;
  readonly academicYearId: string;
  readonly status: string;
  readonly currency: string;
};

type AcademicYearRow = {
  readonly id: string;
  readonly name: string;
};

type ItemDraft = { readonly name: string; readonly amountMajor: string };

export default function AdminFeeStructuresPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<FeeStructureRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [yearNames, setYearNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('active');
  const [items, setItems] = useState<ItemDraft[]>([{ name: '', amountMajor: '' }]);

  async function loadYearPicker(opts: { readonly cursor: string | null; readonly append: boolean }) {
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
      setYearNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const y of list) next[y.id] = y.name;
        return next;
      });
    } catch {
      if (!opts.append) {
        setYears([]);
        setYearsCursor(null);
      }
    } finally {
      setLoadingMoreYears(false);
    }
  }

  async function loadPage(opts: { readonly cursor: string | null; readonly append: boolean }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/fee-structures', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
      });
      const result = await apiRequest<PaginatedEnvelope<FeeStructureRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load fee structures.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadYearPicker({ cursor: null, append: false });
    void loadPage({ cursor: null, append: false });
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;

    const parsedItems: Array<{ name: string; amountMinor: number; sortOrder: number }> = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item === undefined) continue;
      const itemName = item.name.trim();
      if (itemName === '') {
        setError('Each fee item needs a name.');
        return;
      }
      const amountMinor = parseMajorToMinor(item.amountMajor);
      if (amountMinor === null) {
        setError(`Item “${itemName}”: enter a valid TZS amount (up to 2 decimals).`);
        return;
      }
      parsedItems.push({ name: itemName, amountMinor, sortOrder: i });
    }
    if (parsedItems.length === 0) {
      setError('Add at least one fee item.');
      return;
    }

    setBusy(true);
    setError(null);
    const actionKey = `fee-structure.create:${name}:${academicYearId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: FeeStructureRow }>('/api/v1/fee-structures', {
        method: 'POST',
        auth,
        body: {
          academicYearId,
          name: name.trim(),
          status,
          currency: 'TZS',
          items: parsedItems,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setItems([{ name: '', amountMajor: '' }]);
      router.push(`/t/${tenantId}/admin/fees/structures/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not create fee structure.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees`}>← Fees</Link>
      </p>
      <h1>Fee structures</h1>
      <p className="muted">Named fee packages by academic year (ACF-012).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create structure</h2>
        <div className="field">
          <label htmlFor="fs-name">Name</label>
          <input
            id="fs-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="fs-year">Academic year</label>
          <select
            id="fs-year"
            required
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
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
          <label htmlFor="fs-status">Status</label>
          <select
            id="fs-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: '0.875rem' }}>Items (TZS major)</legend>
          {items.map((item, index) => (
            <div key={index} className="stack" style={{ gap: '0.5rem' }}>
              <div className="field">
                <label htmlFor={`item-name-${String(index)}`}>Item name</label>
                <input
                  id={`item-name-${String(index)}`}
                  required
                  value={item.name}
                  onChange={(e) => {
                    const next = items.slice();
                    next[index] = { ...item, name: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={`item-amt-${String(index)}`}>Amount (TZS)</label>
                <input
                  id={`item-amt-${String(index)}`}
                  required
                  inputMode="decimal"
                  placeholder="e.g. 150000.00"
                  value={item.amountMajor}
                  onChange={(e) => {
                    const next = items.slice();
                    next[index] = { ...item, amountMajor: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setItems([...items, { name: '', amountMajor: '' }])}
          >
            Add item
          </button>
        </fieldset>

        <button type="submit" className="btn btn-primary" disabled={busy || academicYearId === ''}>
          {busy ? 'Saving…' : 'Create structure'}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No fee structures yet."
        isEmpty={rows.length === 0}
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
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card" href={`/t/${tenantId}/admin/fees/structures/${row.id}`}>
              <strong>{row.name}</strong>
              <div className="muted">
                <span className="chip">{row.status}</span>
                {' · '}
                {yearNames[row.academicYearId] ?? row.academicYearId}
                {' · '}
                {row.currency}
              </div>
            </Link>
          </li>
        ))}
      </ResourceList>
    </AdminShell>
  );
}
