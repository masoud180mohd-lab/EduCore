'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { formatTzsMinor, parseMajorToMinor, TZS_MINOR_SCALE } from '@/lib/finance/money';

type FeeStructureItem = {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly sortOrder: number;
};

type FeeStructureDetail = {
  readonly id: string;
  readonly name: string;
  readonly academicYearId: string;
  readonly status: string;
  readonly currency: string;
  readonly items: ReadonlyArray<FeeStructureItem>;
};

type ItemDraft = { readonly name: string; readonly amountMajor: string };

type StructureStatus = 'draft' | 'active' | 'archived';

function minorToMajorInput(amountMinor: number): string {
  if (!Number.isFinite(amountMinor) || !Number.isInteger(amountMinor)) return '';
  return (amountMinor / TZS_MINOR_SCALE).toFixed(2);
}

function itemsSignature(
  items: ReadonlyArray<{ readonly name: string; readonly amountMinor: number }>,
): string {
  return JSON.stringify(
    items.map((item, index) => ({
      name: item.name.trim(),
      amountMinor: item.amountMinor,
      sortOrder: index,
    })),
  );
}

export default function AdminFeeStructureDetailPage() {
  const params = useParams<{ tenantId: string; structureId: string }>();
  const { tenantId, structureId } = params;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<FeeStructureDetail | null>(null);
  const [yearName, setYearName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<StructureStatus>('draft');
  const [items, setItems] = useState<ItemDraft[]>([{ name: '', amountMajor: '' }]);
  const [baselineItemsSig, setBaselineItemsSig] = useState('');

  const applyRow = useCallback((detail: FeeStructureDetail) => {
    setRow(detail);
    setName(detail.name);
    setStatus(
      detail.status === 'active' || detail.status === 'archived' || detail.status === 'draft'
        ? detail.status
        : 'draft',
    );
    const drafts =
      detail.items.length === 0
        ? [{ name: '', amountMajor: '' }]
        : detail.items.map((item) => ({
            name: item.name,
            amountMajor: minorToMajorInput(item.amountMinor),
          }));
    setItems(drafts);
    setBaselineItemsSig(
      itemsSignature(
        detail.items.map((item) => ({ name: item.name, amountMinor: item.amountMinor })),
      ),
    );
  }, []);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ data: FeeStructureDetail }>(
        `/api/v1/fee-structures/${structureId}`,
        { auth },
      );
      applyRow(res.data);
      try {
        const year = await apiRequest<{ data: { name: string } }>(
          `/api/v1/academic-years/${res.data.academicYearId}`,
          { auth },
        );
        setYearName(year.data.name);
      } catch {
        setYearName(res.data.academicYearId);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load fee structure.');
    } finally {
      setLoading(false);
    }
  }, [applyRow, structureId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;

    const trimmedName = name.trim();
    if (trimmedName === '') {
      setError('Name is required.');
      return;
    }

    const parsedItems: Array<{ name: string; amountMinor: number; sortOrder: number }> = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item === undefined) continue;
      const itemName = item.name.trim();
      const amountRaw = item.amountMajor.trim();
      if (itemName === '' && amountRaw === '') continue;
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

    const itemsChanged = itemsSignature(parsedItems) !== baselineItemsSig;
    if (itemsChanged && parsedItems.length === 0) {
      setError(t('fees.needItem'));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    const actionKey = `fee-structure.patch:${structureId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    const body: {
      name: string;
      status: StructureStatus;
      items?: Array<{ name: string; amountMinor: number; sortOrder: number }>;
    } = {
      name: trimmedName,
      status,
    };
    if (itemsChanged) body.items = parsedItems;

    try {
      const updated = await apiRequest<{ data: FeeStructureDetail }>(
        `/api/v1/fee-structures/${structureId}`,
        {
          method: 'PATCH',
          auth,
          body,
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      applyRow(updated.data);
      setNotice(
        itemsChanged
          ? 'Fee structure and items saved.'
          : 'Fee structure details saved (items unchanged).',
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not save fee structure.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees/structures`}>← {t('fees.structures')}</Link>
      </p>
      <AdminPageHeader title={row?.name ?? t('structure.title')} />
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {notice !== null ? <Banner tone="info">{notice}</Banner> : null}
      {row !== null ? (
        <>
          <p className="muted">
            <span className="chip">{row.status}</span>
            {' · '}
            {yearName ?? row.academicYearId}
            {' · '}
            {row.currency}
          </p>

          <form className="stack card" onSubmit={(e) => void onSave(e)}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('fees.editStructure')}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {t('fees.editStructureHint')}
            </p>
            <div className="field">
              <label htmlFor="fs-edit-name">{t('common.name')}</label>
              <input
                id="fs-edit-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="fs-edit-status">{t('common.status')}</label>
              <select
                id="fs-edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StructureStatus)}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>

            <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t('fees.itemsLegend')}</legend>
              {items.map((item, index) => (
                <div key={index} className="stack" style={{ gap: '0.5rem' }}>
                  <div className="field">
                    <label htmlFor={`edit-item-name-${String(index)}`}>{t('fees.itemName')}</label>
                    <input
                      id={`edit-item-name-${String(index)}`}
                      value={item.name}
                      onChange={(e) => {
                        const next = items.slice();
                        next[index] = { ...item, name: e.target.value };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-item-amt-${String(index)}`}>Amount (TZS)</label>
                    <input
                      id={`edit-item-amt-${String(index)}`}
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
                {t('fees.addItem')}
              </button>
            </fieldset>

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </form>

          <h2 style={{ fontSize: '1.1rem' }}>{t('fees.total')}</h2>
          <p className="muted">
            Total (items): {formatTzsMinor(row.items.reduce((sum, i) => sum + i.amountMinor, 0))}
          </p>
        </>
      ) : null}
    </AdminShell>
  );
}
