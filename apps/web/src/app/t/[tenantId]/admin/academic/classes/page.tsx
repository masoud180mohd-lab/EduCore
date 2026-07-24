'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type AcademicYearRow,
  type ClassRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminClassesPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [yearNames, setYearNames] = useState<Record<string, string>>({});
  const [filterYearId, setFilterYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
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

      const classQ =
        yearFilter !== ''
          ? `/api/v1/classes?limit=50&academicYearId=${encodeURIComponent(yearFilter)}`
          : '/api/v1/classes?limit=50';
      const classRes = await apiRequest<{ data: ClassRow[] }>(classQ, { auth });
      setRows(classRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load classes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filterYearId);
  }, [filterYearId]);

  useEffect(() => {
    const auth = readSession();
    if (auth === null || academicYearId === '') {
      setTerms([]);
      return;
    }
    void (async () => {
      try {
        const termRes = await apiRequest<{ data: TermRow[] }>(
          `/api/v1/terms?limit=50&academicYearId=${encodeURIComponent(academicYearId)}`,
          { auth },
        );
        setTerms(termRes.data ?? []);
      } catch {
        setTerms([]);
      }
    })();
  }, [academicYearId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || academicYearId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `class.create:${academicYearId}:${name}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        academicYearId,
        name: name.trim(),
        status,
      };
      if (code.trim() !== '') body['code'] = code.trim();
      if (termId !== '') body['termId'] = termId;
      const created = await apiRequest<{ data: ClassRow }>('/api/v1/classes', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      setTermId('');
      router.push(`/t/${tenantId}/admin/academic/classes/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not create class.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← Academic</Link>
      </p>
      <h1>Classes</h1>
      <p className="muted">Classes belong to an academic year; term is optional (ACF-005).</p>
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
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create class</h2>
        <div className="field">
          <label htmlFor="class-year">Academic year</label>
          <select
            id="class-year"
            required
            value={academicYearId}
            onChange={(e) => {
              setAcademicYearId(e.target.value);
              setTermId('');
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
          <label htmlFor="class-term">Term (optional)</label>
          <select id="class-term" value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">None</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="class-name">Name</label>
          <input
            id="class-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="class-code">Code (optional)</label>
          <input id="class-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="class-status">Status</label>
          <select
            id="class-status"
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
          {busy ? 'Saving…' : 'Create class'}
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No classes yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card" href={`/t/${tenantId}/admin/academic/classes/${row.id}`}>
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
