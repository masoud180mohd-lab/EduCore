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
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { t } = useAppPreferences();
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
      const res = await apiRequest<{ data: OrganizationRow }>(
        `/api/v1/organizations/${parentId}`,
        { auth },
      );
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
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/t/${tenantId}/admin/organizations`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {t('orgs.title')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <AdminPageHeader title={row?.name ?? t('orgs.organization')}>
              {row !== null ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">Type: {row.orgType}</span>
                  <StatusChip label={row.status} tone={row.status === 'active' ? 'ok' : 'muted'} />
                </div>
              ) : null}
            </AdminPageHeader>
          </div>
        </div>

        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {info !== null ? <Banner tone="info">{info}</Banner> : null}

        {row !== null ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('orgs.organization')}</CardTitle>
              <CardDescription>{row.code ? `Code: ${row.code}` : 'No code assigned'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4 max-w-md" onSubmit={(e) => void onSave(e)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t('common.name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">{t('common.codeOptional')}</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    pattern="[a-z0-9-]{0,64}"
                    title={t('orgs.codeHint')}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="parentOrganizationId">Parent organization (optional)</Label>
                  <select
                    id="parentOrganizationId"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={busy}>
                    {busy ? t('common.saving') : t('common.save')}
                  </Button>
                  {row.status !== 'inactive' ? (
                    <Button
                      variant="outline"
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmOpen(true)}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">This organization is inactive.</p>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        ) : error === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : null}

        <ConfirmDialog
          open={confirmOpen}
          title={t('orgs.deactivate')}
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
      </div>
    </AdminShell>
  );
}
