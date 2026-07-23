'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type Guardian = {
  readonly id: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly userId: string | null;
};

type LinkRow = {
  readonly id: string;
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
};

type StudentRow = { readonly id: string; readonly displayName: string };

export default function AdminGuardianDetailPage() {
  const params = useParams<{ tenantId: string; guardianId: string }>();
  const { tenantId, guardianId } = params;
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentId, setStudentId] = useState('');
  const [relationshipType, setRelationshipType] = useState('guardian');
  const [bindUserId, setBindUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setError(null);
    try {
      const [gRes, lRes, sRes] = await Promise.all([
        apiRequest<{ data: Guardian }>(`/api/v1/guardians/${guardianId}`, { auth }),
        apiRequest<{ data: LinkRow[] }>(`/api/v1/guardians/${guardianId}/links`, { auth }),
        apiRequest<{ data: StudentRow[] }>('/api/v1/students?limit=100&status=active', { auth }),
      ]);
      setGuardian(gRes.data);
      setLinks(lRes.data ?? []);
      setStudents(sRes.data ?? []);
      const nameMap: Record<string, string> = {};
      await Promise.all(
        (lRes.data ?? []).map(async (link) => {
          try {
            const st = await apiRequest<{ data: StudentRow }>(
              `/api/v1/students/${link.studentId}`,
              { auth },
            );
            nameMap[link.studentId] = st.data.displayName;
          } catch {
            nameMap[link.studentId] = link.studentId;
          }
        }),
      );
      setNames(nameMap);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load guardian.');
    }
  }, [guardianId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLink(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || studentId === '') return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.link:${guardianId}:${studentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/links`, {
        method: 'POST',
        auth,
        body: { studentId, relationshipType },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Student linked.');
      setStudentId('');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not link student.');
    } finally {
      setBusy(false);
    }
  }

  async function onEnd(linkId: string) {
    const auth = readSession();
    if (auth === null) return;
    if (!window.confirm('End this guardian link?')) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/links/${linkId}/end`, {
        method: 'POST',
        auth,
      });
      setInfo('Link ended.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not end link.');
    } finally {
      setBusy(false);
    }
  }

  async function onBind(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || bindUserId.trim() === '') return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.bind:${guardianId}:${bindUserId.trim()}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/bind-user`, {
        method: 'POST',
        auth,
        body: { userId: bindUserId.trim() },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Portal user bound. They can sign in and open Parent fees.');
      setBindUserId('');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not bind user.');
    } finally {
      setBusy(false);
    }
  }

  async function onUnbind() {
    const auth = readSession();
    if (auth === null) return;
    if (!window.confirm('Unbind portal user from this guardian?')) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `guardian.unbind:${guardianId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/guardians/${guardianId}/unbind-user`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Portal user unbound.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not unbind user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>{guardian?.displayName ?? 'Guardian'}</h1>
      {guardian !== null ? (
        <p className="muted">
          {[guardian.email, guardian.phone, guardian.status].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <p>
        <Link
          className="btn btn-secondary"
          href={`/t/${tenantId}/admin/guardians/${guardianId}/fees`}
        >
          View fees (read-only)
        </Link>
      </p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {info !== null ? (
        <div className="banner banner-info" role="status">
          {info}
        </div>
      ) : null}

      <h2 style={{ fontSize: '1.1rem' }}>Portal bind</h2>
      <p className="muted">
        Bind an existing school user (active membership) so they can open the parent fees portal.
      </p>
      {guardian?.userId !== null && guardian?.userId !== undefined ? (
        <div className="card stack">
          <div className="muted">Bound user: {guardian.userId}</div>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void onUnbind()}
          >
            Unbind user
          </button>
        </div>
      ) : (
        <form className="stack card" onSubmit={(e) => void onBind(e)}>
          <div className="field">
            <label htmlFor="bindUserId">User ID (UUID)</label>
            <input
              id="bindUserId"
              required
              value={bindUserId}
              onChange={(e) => setBindUserId(e.target.value)}
              placeholder="User UUID with active membership"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || bindUserId === ''}>
            {busy ? 'Saving…' : 'Bind portal user'}
          </button>
        </form>
      )}

      <h2 style={{ fontSize: '1.1rem' }}>Linked students</h2>
      {links.length === 0 ? <div className="banner banner-info">No links yet.</div> : null}
      <ul className="list">
        {links.map((link) => (
          <li key={link.id} className="card">
            <strong>{names[link.studentId] ?? link.studentId}</strong>
            <div className="muted">
              {link.relationshipType} · {link.status}
              {link.isPrimary ? ' · primary' : ''}
            </div>
            {link.status === 'active' ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void onEnd(link.id)}
              >
                End link
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <form className="stack card" onSubmit={(e) => void onLink(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Link student</h2>
        <div className="field">
          <label htmlFor="studentId">Student</label>
          <select
            id="studentId"
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
          <label htmlFor="relationshipType">Relationship</label>
          <select
            id="relationshipType"
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
          >
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || studentId === ''}>
          {busy ? 'Saving…' : 'Link'}
        </button>
      </form>
    </AdminShell>
  );
}
