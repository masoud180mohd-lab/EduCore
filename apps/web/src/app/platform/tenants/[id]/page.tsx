'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminPageHeader, AdminTable, Banner, ConfirmDialog, StatusChip } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { formatMessage } from '@/lib/i18n/messages';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import {
  PLATFORM_ENTITLEMENT_CODES,
  type PlatformAuditRow,
  type PlatformEntitlementCode,
  type PlatformPlanRow,
  type PlatformTenantDetail,
} from '@/lib/platform/types';
import { buildListQuery, type PaginatedEnvelope } from '@/lib/admin/list-pagination';

type ConfirmKind =
  | { readonly kind: 'suspend' }
  | { readonly kind: 'reinstate' }
  | { readonly kind: 'plan'; readonly planCode: string }
  | {
      readonly kind: 'entitlement';
      readonly code: PlatformEntitlementCode;
      readonly enabled: boolean;
      readonly limit: number | null;
    };

function statusTone(status: string): 'ok' | 'muted' | 'neutral' {
  if (status === 'active') return 'ok';
  if (status === 'draft' || status === 'suspended' || status === 'closed') return 'muted';
  return 'neutral';
}

export default function PlatformSchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params.id;
  const { t } = useAppPreferences();
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [plans, setPlans] = useState<ReadonlyArray<PlatformPlanRow>>([]);
  const [audit, setAudit] = useState<ReadonlyArray<PlatformAuditRow>>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showId, setShowId] = useState(false);
  const [planCode, setPlanCode] = useState('');
  const [entitlementDrafts, setEntitlementDrafts] = useState<
    Record<string, { enabled: boolean; limit: string }>
  >({});
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [reason, setReason] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocale, setEditLocale] = useState<'en' | 'sw'>('en');
  const [editTimezone, setEditTimezone] = useState('');

  async function load() {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [tenantRes, plansRes, auditRes] = await Promise.all([
        apiRequest<{ data: PlatformTenantDetail }>(`/api/v1/platform/tenants/${tenantId}`, {
          auth,
          requireTenant: false,
        }),
        apiRequest<{ data: ReadonlyArray<PlatformPlanRow> }>('/api/v1/platform/plans', {
          auth,
          requireTenant: false,
        }),
        apiRequest<PaginatedEnvelope<PlatformAuditRow>>(
          buildListQuery('/api/v1/platform/audit', {
            limit: 10,
            filters: { tenantId },
          }),
          { auth, requireTenant: false },
        ),
      ]);
      setTenant(tenantRes.data);
      setEditName(tenantRes.data.name);
      setEditLocale(tenantRes.data.primaryLocale === 'sw' ? 'sw' : 'en');
      setEditTimezone(tenantRes.data.timezone);
      setPlans(plansRes.data ?? []);
      setPlanCode(tenantRes.data.planCode ?? '');
      setAudit(auditRes.data ?? []);
      const drafts: Record<string, { enabled: boolean; limit: string }> = {};
      for (const code of PLATFORM_ENTITLEMENT_CODES) {
        const row = tenantRes.data.entitlements.find((item) => item.code === code);
        drafts[code] = {
          enabled: row?.enabled ?? false,
          limit: row?.limit === null || row?.limit === undefined ? '' : String(row.limit),
        };
      }
      setEntitlementDrafts(drafts);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) setError(t('platform.forbidden'));
      else setError(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tenantId]);

  async function runWrite(path: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await apiRequest<{ data: PlatformTenantDetail }>(path, {
        method,
        auth,
        requireTenant: false,
        body,
      });
      setTenant(result.data);
      setEditName(result.data.name);
      setEditLocale(result.data.primaryLocale === 'sw' ? 'sw' : 'en');
      setEditTimezone(result.data.timezone);
      setIsEditingProfile(false);
      setPlanCode(result.data.planCode ?? '');
      setInfo(t('platform.writeSuccess'));
      setConfirm(null);
      setReason('');
      const auditRes = await apiRequest<PaginatedEnvelope<PlatformAuditRow>>(
        buildListQuery('/api/v1/platform/audit', { limit: 10, filters: { tenantId } }),
        { auth, requireTenant: false },
      );
      setAudit(auditRes.data ?? []);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) setError(t('platform.forbidden'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('platform.writeError'));
    } finally {
      setBusy(false);
    }
  }

  function onConfirm() {
    if (confirm === null || tenant === null) return;
    if (confirm.kind === 'suspend') {
      void runWrite(`/api/v1/platform/tenants/${tenant.id}/suspend`, 'POST', {
        reason: reason.trim(),
      });
      return;
    }
    if (confirm.kind === 'reinstate') {
      void runWrite(`/api/v1/platform/tenants/${tenant.id}/reinstate`, 'POST', {
        reason: reason.trim(),
      });
      return;
    }
    if (confirm.kind === 'plan') {
      void runWrite(`/api/v1/platform/tenants/${tenant.id}/plan`, 'PUT', {
        planCode: confirm.planCode,
        reason: reason.trim(),
      });
      return;
    }
    void runWrite(`/api/v1/platform/tenants/${tenant.id}/entitlements/${confirm.code}`, 'PUT', {
      enabled: confirm.enabled,
      limit: confirm.limit,
      reason: reason.trim(),
    });
  }

  function onSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (tenant === null) return;
    void runWrite(`/api/v1/platform/tenants/${tenant.id}`, 'PATCH', {
      name: editName.trim(),
      primaryLocale: editLocale,
      timezone: editTimezone.trim(),
    });
  }

  function entitlementLabel(code: string): string {
    const key = `entitlement.${code}`;
    const translated = t(key as never);
    return translated === key ? code : translated;
  }

  if (loading) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  if (tenant === null) {
    return (
      <div className="stack">
        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        <Link href="/platform">{t('common.back')}</Link>
      </div>
    );
  }

  const confirmTitle =
    confirm?.kind === 'suspend'
      ? formatMessage(t('platform.suspendTitle'), { name: tenant.name })
      : confirm?.kind === 'reinstate'
        ? formatMessage(t('platform.reinstateTitle'), { name: tenant.name })
        : confirm?.kind === 'plan'
          ? formatMessage(t('platform.assignPlanTitle'), { name: tenant.name })
          : confirm !== null
            ? formatMessage(t('platform.entitlementTitle'), {
                name: tenant.name,
                code: entitlementLabel(confirm.code),
              })
            : '';
  const confirmBody =
    confirm?.kind === 'suspend'
      ? t('platform.suspendBody')
      : confirm?.kind === 'reinstate'
        ? t('platform.reinstateBody')
        : confirm?.kind === 'plan'
          ? t('platform.assignPlanBody')
          : t('platform.entitlementBody');

  return (
    <div className="stack">
      <AdminPageHeader title={tenant.name} description={t('platform.detailTitle')}>
        <Link className="btn btn-secondary" href="/platform">
          {t('common.back')}
        </Link>
        <button type="button" className="btn btn-secondary" onClick={() => setShowId((v) => !v)}>
          {showId ? t('platform.hideId') : t('platform.showId')}
        </button>
      </AdminPageHeader>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}

      <section className="card stack">
        <div className="flex items-center justify-between">
          <h2 className="section-title">{t('platform.profile')}</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditingProfile((prev) => !prev)}
          >
            {isEditingProfile ? t('common.back') : 'Hariri Taarifa'}
          </button>
        </div>

        {isEditingProfile ? (
          <form className="stack" onSubmit={onSaveProfile}>
            <label>
              <strong>{t('platform.name')}:</strong>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              <strong>{t('platform.locale')}:</strong>
              <select
                value={editLocale}
                onChange={(e) => setEditLocale(e.target.value as 'en' | 'sw')}
              >
                <option value="en">English (en)</option>
                <option value="sw">Kiswahili (sw)</option>
              </select>
            </label>
            <label>
              <strong>{t('platform.timezone')}:</strong>
              <input
                type="text"
                required
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
                maxLength={80}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditingProfile(false)}
              >
                {t('common.back')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p>
              <strong>{t('platform.code')}:</strong> {tenant.code}
            </p>
            <p>
              <strong>{t('platform.locale')}:</strong> {tenant.primaryLocale}
            </p>
            <p>
              <strong>{t('platform.timezone')}:</strong> {tenant.timezone}
            </p>
            {showId ? <p className="muted">{tenant.id}</p> : null}
          </>
        )}
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('platform.status')}</h2>
        <StatusChip label={tenant.status} tone={statusTone(tenant.status)} />
        <div className="actions">
          {tenant.status === 'active' ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirm({ kind: 'suspend' })}
            >
              {t('platform.suspend')}
            </button>
          ) : null}
          {tenant.status === 'suspended' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirm({ kind: 'reinstate' })}
            >
              {t('platform.reinstate')}
            </button>
          ) : null}
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('platform.plan')}</h2>
        <p>{tenant.planCode ?? '—'}</p>
        <form
          className="actions"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (planCode !== '') setConfirm({ kind: 'plan', planCode });
          }}
        >
          <label>
            {t('platform.assignPlan')}
            <select value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
              <option value="">{t('common.select')}</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={planCode === '' || planCode === tenant.planCode}
          >
            {t('platform.assignPlan')}
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('platform.entitlements')}</h2>
        {PLATFORM_ENTITLEMENT_CODES.map((code) => {
          const draft = entitlementDrafts[code] ?? { enabled: false, limit: '' };
          return (
            <form
              key={code}
              className="actions"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                const limit = draft.limit.trim() === '' ? null : Number(draft.limit);
                setConfirm({
                  kind: 'entitlement',
                  code,
                  enabled: draft.enabled,
                  limit: Number.isInteger(limit) ? limit : null,
                });
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setEntitlementDrafts((prev) => ({
                      ...prev,
                      [code]: { ...draft, enabled: event.target.checked },
                    }))
                  }
                />
                {entitlementLabel(code)}
              </label>
              <label>
                {t('platform.limit')}
                <input
                  type="number"
                  min={0}
                  value={draft.limit}
                  onChange={(event) =>
                    setEntitlementDrafts((prev) => ({
                      ...prev,
                      [code]: { ...draft, limit: event.target.value },
                    }))
                  }
                />
              </label>
              <button type="submit" className="btn btn-secondary">
                {t('platform.setEntitlement')}
              </button>
            </form>
          );
        })}
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('platform.recentAudit')}</h2>
        {audit.length === 0 ? (
          <Banner tone="info">{t('platform.emptyAudit')}</Banner>
        ) : (
          <AdminTable
            caption={t('platform.recentAudit')}
            headers={[t('platform.time'), t('platform.action'), t('platform.outcome')]}
          >
            {audit.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.occurredAt).toLocaleString()}</td>
                <td>{row.action}</td>
                <td>{row.outcome}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirmTitle}
        body={confirmBody}
        danger={confirm?.kind === 'suspend'}
        busy={busy}
        reasonRequired
        reasonValue={reason}
        onReasonChange={setReason}
        onConfirm={onConfirm}
        onCancel={() => {
          if (!busy) {
            setConfirm(null);
            setReason('');
          }
        }}
      />
    </div>
  );
}
