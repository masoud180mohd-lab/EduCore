'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type MembershipStatus = 'invited' | 'active' | 'suspended' | 'removed';

type MembershipRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: string;
  readonly joinedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const STATUS_FILTERS: ReadonlyArray<{ value: '' | MembershipStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'removed', label: 'Removed' },
];

function membershipMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  return teacherFriendlyMessage(err);
}

export default function AdminMembershipsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [status, setStatus] = useState<'' | MembershipStatus>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(statusFilter: '' | MembershipStatus) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const q =
        statusFilter === ''
          ? '/api/v1/memberships?limit=50'
          : `/api/v1/memberships?limit=50&status=${encodeURIComponent(statusFilter)}`;
      const result = await apiRequest<{ data: MembershipRow[] }>(q, { auth });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(membershipMessage(err));
      else setError('Could not load memberships.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    void load(status);
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Memberships</h1>
      <p className="muted">
        Tenant roster by membership status. Open a user to suspend, reactivate, or remove.
      </p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack" onSubmit={onFilter} style={{ marginBottom: '1rem' }}>
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | MembershipStatus)}
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Apply filter'}
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No memberships for this filter.</p>
      ) : (
        <ul className="list">
          {rows.map((m) => (
            <li key={m.id}>
              <Link className="card" href={`/t/${tenantId}/admin/users/${m.userId}`}>
                <strong>{m.status}</strong>
                <div className="muted">
                  User {m.userId}
                  {m.joinedAt !== null ? ` · Joined ${m.joinedAt}` : null}
                </div>
                <div className="muted">Membership {m.id}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
