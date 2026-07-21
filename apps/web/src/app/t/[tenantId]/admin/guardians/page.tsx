'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readOrCreateIdempotencyKey, clearIdempotencyKey, readSession } from '@/lib/auth/session';

type GuardianRow = {
  readonly id: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
};

export default function AdminGuardiansPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<GuardianRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const result = await apiRequest<{ data: GuardianRow[] }>('/api/v1/guardians?limit=50', {
        auth,
      });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load guardians.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `guardian.create:${displayName}:${email}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { displayName: displayName.trim() };
      if (phone.trim() !== '') body['phone'] = phone.trim();
      if (email.trim() !== '') body['email'] = email.trim();
      const created = await apiRequest<{ data: GuardianRow }>('/api/v1/guardians', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setDisplayName('');
      setPhone('');
      setEmail('');
      router.push(`/t/${tenantId}/admin/guardians/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not create guardian.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Guardians</h1>
      <p className="muted">Parent/guardian directory and student links (ACF-010).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add guardian</h2>
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone (optional)</label>
          <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Email (optional)</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create'}
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No guardians yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((g) => (
          <li key={g.id}>
            <Link className="card" href={`/t/${tenantId}/admin/guardians/${g.id}`}>
              <strong>{g.displayName}</strong>
              <div className="muted">
                {[g.email, g.phone, g.status].filter(Boolean).join(' · ')}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
