'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { canFinanceReconcile } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type MeEnvelope = { readonly data: MeLike };

type SyncPendingResult = {
  readonly scanned: number;
  readonly completed: number;
  readonly results: ReadonlyArray<{
    readonly paymentAttemptId: string;
    readonly providerStatus: string;
    readonly completed: boolean;
    readonly detail: string;
  }>;
};

const FAKE_PROVIDER_BANNER =
  'Collect fees at the office (cash, bank, or cheque). Mobile money waits until a ClickPesa account exists (PAY-007).';

export default function AdminFeesHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const base = `/t/${tenantId}/admin/fees`;

  const [canReconcile, setCanReconcile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth });
      setCanReconcile(canFinanceReconcile(me.data));
    } catch {
      setCanReconcile(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  async function onSyncPending() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = 'payment.sync-provider-pending';
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: SyncPendingResult }>(
        '/api/v1/payments/sync-provider-pending',
        {
          method: 'POST',
          auth,
          body: { limit: 25 },
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      const data = result.data;
      setInfo(`Sync pending: scanned ${data.scanned}, completed ${data.completed}.`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 501 || err.code === 'NOT_IMPLEMENTED') {
          setError(FAKE_PROVIDER_BANNER);
        } else {
          setError(adminFriendlyMessage(err, 'finance', { action: 'reconcile' }));
        }
      } else setError('Could not sync pending payments.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin`}>← Admin</Link>
      </p>
      <AdminPageHeader
        title="Fees"
        description="Bursar path: structures → invoices → office payment (cash/bank/cheque) → receipts. Mobile money later (PAY-007)."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      <Banner tone="info">{FAKE_PROVIDER_BANNER}</Banner>
      {canReconcile ? (
        <div className="actions" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void onSyncPending()}
            title="Query ClickPesa for up to 25 pending mobile-money attempts in this school."
          >
            {busy ? 'Syncing…' : 'Sync pending (tenant)'}
          </button>
        </div>
      ) : null}
      <ul className="list">
        <li>
          <Link className="card" href={`${base}/structures`}>
            <strong>Fee structures</strong>
            <div className="muted">Named fee items by academic year</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/invoices`}>
            <strong>Invoices</strong>
            <div className="muted">Draft, issue, void, filter, office pay</div>
          </Link>
        </li>
        <li>
          <Link className="card" href={`${base}/receipts`}>
            <strong>Receipts</strong>
            <div className="muted">Payment receipts by number and status (no list filters yet)</div>
          </Link>
        </li>
      </ul>
    </AdminShell>
  );
}
