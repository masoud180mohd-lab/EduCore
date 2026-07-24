'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type OrganizationRow, organizationMessage } from '@/lib/organizations/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ tenantId: string; organizationId: string }>();
  const { tenantId, organizationId } = params;
  const [row, setRow] = useState<OrganizationRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentOrganizationId, setParentOrganizationId] = useState('');

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: OrganizationRow }>(
        `/api/v1/organizations/${organizationId}`,
        { auth },
      );
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setParentOrganizationId(result.data.parentOrganizationId ?? '');
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(organizationMessage(err));
      else setError('Could not load organization.');
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `org.patch:${organizationId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: OrganizationRow }>(`/api/v1/organizations/${organizationId}`, {
        method: 'PATCH',
        auth,
        body: {
          name: name.trim(),
          code: code.trim() === '' ? null : code.trim(),
          parentOrganizationId:
            parentOrganizationId.trim() === '' ? null : parentOrganizationId.trim(),
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Organization updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(organizationMessage(err));
      else setError('Could not update organization.');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (row === null || row.status === 'inactive') return;
    if (!window.confirm(`Deactivate “${row.name}”? It will become inactive.`)) return;
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `org.deactivate:${organizationId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: OrganizationRow }>(
        `/api/v1/organizations/${organizationId}/deactivate`,
        {
          method: 'POST',
          auth,
          body: {},
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      setInfo('Organization deactivated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(organizationMessage(err));
      else setError('Could not deactivate organization.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/organizations`}>← Organizations</Link>
      </p>
      <h1>{row?.name ?? 'Organization'}</h1>
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
      {row !== null ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>Code (optional)</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                pattern="[a-z0-9-]{0,64}"
                title="Lowercase letters, numbers, hyphens"
              />
            </label>
            <label className="field">
              <span>Parent organization id (optional)</span>
              <input
                value={parentOrganizationId}
                onChange={(e) => setParentOrganizationId(e.target.value)}
                placeholder="UUID or empty to clear"
              />
            </label>
            <div className="muted">
              Type: {row.orgType} · Status: {row.status} · Id: {row.id}
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
          {row.status !== 'inactive' ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => void onDeactivate()}
            >
              Deactivate
            </button>
          ) : (
            <p className="muted">This organization is inactive.</p>
          )}
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
