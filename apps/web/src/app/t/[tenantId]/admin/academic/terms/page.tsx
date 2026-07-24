'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type AcademicYearRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminTermsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<TermRow[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearNames, setYearNames] = useState<Record<string, string>>({});
  const [filterYearId, setFilterYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('active');

  async function load(yearFilter: string) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const yearRes = await apiRequest<{ data: AcademicYearRow[] }>(
        '/api/v1/academic-years?limit=50',
        { auth },
      );
      const yearList = yearRes.data ?? [];
      setYears(yearList);
      const map: Record<string, string> = {};
      for (const y of yearList) map[y.id] = y.name;
      setYearNames(map);

      const q =
        yearFilter !== ''
          ? `/api/v1/terms?limit=50&academicYearId=${encodeURIComponent(yearFilter)}`
          : '/api/v1/terms?limit=50';
      const termRes = await apiRequest<{ data: TermRow[] }>(q, { auth });
      setRows(termRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load terms.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filterYearId);
  }, [filterYearId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || academicYearId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `term.create:${academicYearId}:${name}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        academicYearId,
        name: name.trim(),
        status,
      };
      if (code.trim() !== '') body['code'] = code.trim();
      if (startsOn !== '') body['startsOn'] = startsOn;
      if (endsOn !== '') body['endsOn'] = endsOn;
      const created = await apiRequest<{ data: TermRow }>('/api/v1/terms', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      setStartsOn('');
      setEndsOn('');
      router.push(`/t/${tenantId}/admin/academic/terms/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not create term.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← Academic</Link>
      </p>
      <h1>Terms</h1>
      <p className="muted">Terms belong to an academic year (ACF-004).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="filter-year">Filter by year</label>
        <select
          id="filter-year"
          value={filterYearId}
          onChange={(e) => setFilterYearId(e.target.value)}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </div>

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create term</h2>
        <div className="field">
          <label htmlFor="term-year">Academic year</label>
          <select
            id="term-year"
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
        </div>
        <div className="field">
          <label htmlFor="term-name">Name</label>
          <input
            id="term-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="term-code">Code (optional)</label>
          <input id="term-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="term-starts">Starts on (optional)</label>
          <input
            id="term-starts"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="term-ends">Ends on (optional)</label>
          <input
            id="term-ends"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="term-status">Status</label>
          <select
            id="term-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LifecycleStatus)}
          >
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || academicYearId === ''}>
          {busy ? 'Saving…' : 'Create term'}
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No terms yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card" href={`/t/${tenantId}/admin/academic/terms/${row.id}`}>
              <strong>{row.name}</strong>
              <div className="muted">
                <span className="chip">{row.status}</span>
                {' · '}
                {yearNames[row.academicYearId] ?? row.academicYearId}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
