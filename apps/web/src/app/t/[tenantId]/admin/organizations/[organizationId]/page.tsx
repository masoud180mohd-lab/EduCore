'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  AdminPageHeader,
  Banner,
  ConfirmDialog,
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
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { type OrganizationRow } from '@/lib/organizations/types';

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ tenantId: string; organizationId: string }>();
  const { tenantId, organizationId } = params;
  const [row, setRow] = useState<OrganizationRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentOrganizationId, setParentOrganizationId] = useState('');
  const [parentOptions, setParentOptions] = useState<OrganizationRow[]>([]);
  const [parentsCursor, setParentsCursor] = useState<string | null>(null);
  const [loadingMoreParents, setLoadingMoreParents] = useState(false);

  const loadParentPicker = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setLoadingMoreParents(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<OrganizationRow>>(
          buildListQuery('/api/v1/organizations', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
            filters: { status: 'active' },
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = (result.data ?? []).filter((o) => o.id !== organizationId);
        setParentOptions((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setParentsCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setParentOptions([]);
          setParentsCursor(null);
        }
      } finally {
        setLoadingMoreParents(false);
      }
    },
    [organizationId],
  );

  const ensureParentOption = useCallback(async (parentId: string) => {
    if (parentId === '') return;
    const auth = readSession();
    if (auth === null) return;
    try {
      const res = await apiRequest<{ data: OrganizationRow }>(`/api/v1/organizations/${parentId}`, {
        auth,
      });
      setParentOptions((prev) => appendById(prev, [res.data]));
    } catch {
      /* select still holds id until picker catches up */
    }
  }, []);

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
      const parentId = result.data.parentOrganizationId ?? '';
      setParentOrganizationId(parentId);
      setError(null);
      if (parentId !== '') {
        await ensureParentOption(parentId);
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'organizations'));
      else setError('Could not load organization.');
    }
  }, [organizationId, ensureParentOption]);

  useEffect(() => {
    void load();
    void loadParentPicker({ cursor: null, append: false });
  }, [load, loadParentPicker]);

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
          parentOrganizationId: parentOrganizationId === '' ? null : parentOrganizationId,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Organization updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'organizations'));
      else setError('Could not update organization.');
    } finally {
      setBusy(false);
    }
  }

  async function runDeactivate() {
    if (row === null || row.status === 'inactive') return;
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
      setConfirmOpen(false);
      setInfo('Organization deactivated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'organizations'));
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
      <AdminPageHeader title={row?.name ?? 'Organization'}>
        {row !== null ? (
          <p className="muted">
            Type: {row.orgType} ·{' '}
            <StatusChip label={row.status} tone={row.status === 'active' ? 'ok' : 'muted'} />
          </p>
        ) : null}
      </AdminPageHeader>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
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
            <div className="field">
              <label htmlFor="parentOrganizationId">Parent organization (optional)</label>
              <select
                id="parentOrganizationId"
                value={parentOrganizationId}
                onChange={(e) => setParentOrganizationId(e.target.value)}
              >
                <option value="">None</option>
                {parentOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.code !== null && o.code !== '' ? ` (${o.code})` : ''}
                  </option>
                ))}
              </select>
              <ResourceListPagination
                nextCursor={parentsCursor}
                loadingMore={loadingMoreParents}
                onLoadMore={() => {
                  void loadParentPicker({ cursor: parentsCursor, append: true });
                }}
              />
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
              onClick={() => setConfirmOpen(true)}
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

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate organization?"
        body={
          row !== null
            ? `Deactivate “${row.name}”? It will become inactive.`
            : 'Deactivate this organization?'
        }
        confirmLabel="Deactivate"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void runDeactivate();
        }}
      />
    </AdminShell>
  );
}
