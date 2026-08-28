'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog } from '@/components/admin';
import { AdminMfaPanel } from '@/components/admin/AdminMfaPanel';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  extrasJsonChanged,
  extrasToJson,
  mergeSettingsForSave,
  splitKnownSettings,
  validateExtrasJson,
} from '@/lib/admin/tenant-settings-form';
import { canManageTenantSettings } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type TenantSettingsDoc = {
  readonly schemaVersion: number;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly updatedAt?: string;
};

type MeEnvelope = {
  readonly data: MeLike;
};

export default function AdminSettingsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [currency, setCurrency] = useState('');
  const [loadedExtras, setLoadedExtras] = useState<Record<string, unknown>>({});
  const [initialExtrasJson, setInitialExtrasJson] = useState('{}');
  const [extrasJson, setExtrasJson] = useState('{}');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmAdvancedSave, setConfirmAdvancedSave] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [settingsRes, meRes] = await Promise.all([
        apiRequest<{ data: TenantSettingsDoc }>('/api/v1/tenant-settings', { auth }),
        apiRequest<MeEnvelope>('/api/v1/auth/me', { auth }),
      ]);
      const data = settingsRes.data;
      setSchemaVersion(data.schemaVersion);
      setUpdatedAt(data.updatedAt ?? null);
      const split = splitKnownSettings(data.settings ?? {});
      setTimezone(split.known.timezone);
      setLocale(split.known.locale);
      setCurrency(split.known.currency);
      setLoadedExtras(split.extras);
      const extrasText = extrasToJson(split.extras);
      setExtrasJson(extrasText);
      setInitialExtrasJson(extrasText);
      setCanManage(canManageTenantSettings(meRes.data));
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError('Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSave(settings: Record<string, unknown>) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `tenant-settings.put:${tenantId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: TenantSettingsDoc }>('/api/v1/tenant-settings', {
        method: 'PUT',
        auth,
        body: { schemaVersion, settings },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Settings saved.');
      setUpdatedAt(result.data.updatedAt ?? null);
      const split = splitKnownSettings(result.data.settings ?? {});
      setTimezone(split.known.timezone);
      setLocale(split.known.locale);
      setCurrency(split.known.currency);
      setLoadedExtras(split.extras);
      const extrasText = extrasToJson(split.extras);
      setExtrasJson(extrasText);
      setInitialExtrasJson(extrasText);
      setSchemaVersion(result.data.schemaVersion);
      setConfirmAdvancedSave(false);
      setPendingSettings(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError('Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;

    const known = { timezone, locale, currency };

    if (!showAdvanced) {
      void runSave(mergeSettingsForSave(loadedExtras, known));
      return;
    }

    const validated = validateExtrasJson(extrasJson);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    const settings = mergeSettingsForSave(validated.extras, known);
    if (extrasJsonChanged(extrasJson, initialExtrasJson)) {
      setPendingSettings(settings);
      setConfirmAdvancedSave(true);
      return;
    }
    void runSave(settings);
  }

  const readOnly = !canManage;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader title={t('settings.title')} description={t('settings.description')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {readOnly ? <Banner tone="info">{t('settings.readOnly')}</Banner> : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading ? (
        <form className="stack card" onSubmit={onSave}>
          <p className="muted">{t('settings.schema', { version: schemaVersion })}</p>
          <div className="field">
            <label htmlFor="timezone">{t('settings.timezone')}</label>
            <input
              id="timezone"
              value={timezone}
              disabled={readOnly || busy}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Africa/Dar_es_Salaam"
            />
          </div>
          <div className="field">
            <label htmlFor="locale">{t('settings.locale')}</label>
            <input
              id="locale"
              value={locale}
              disabled={readOnly || busy}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="e.g. en-TZ"
            />
          </div>
          <div className="field">
            <label htmlFor="currency">{t('settings.currency')}</label>
            <input
              id="currency"
              value={currency}
              disabled={readOnly || busy}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="e.g. TZS"
            />
          </div>
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setShowAdvanced((open) => {
                  if (open) {
                    setExtrasJson(initialExtrasJson);
                  }
                  return !open;
                });
              }}
            >
              {showAdvanced ? t('settings.hideAdvanced') : t('settings.advanced')}
            </button>
          </div>
          {showAdvanced ? (
            <>
              <Banner tone="error">{t('settings.advancedWarn')}</Banner>
              <div className="field">
                <label htmlFor="extrasJson">{t('settings.extras')}</label>
                <textarea
                  id="extrasJson"
                  rows={8}
                  value={extrasJson}
                  disabled={readOnly || busy}
                  onChange={(e) => setExtrasJson(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
                />
              </div>
            </>
          ) : null}
          {updatedAt !== null ? <p className="muted">Last updated: {updatedAt}</p> : null}
          {canManage ? (
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          ) : null}
        </form>
      ) : null}

      <AdminMfaPanel />

      <ConfirmDialog
        open={confirmAdvancedSave}
        title={t('settings.saveAdvanced')}
        body="You changed additional settings JSON. Saving replaces extra keys on the server. Continue only if the JSON is correct."
        confirmLabel={t('common.save')}
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setConfirmAdvancedSave(false);
            setPendingSettings(null);
          }
        }}
        onConfirm={() => {
          if (pendingSettings !== null) void runSave(pendingSettings);
        }}
      />
    </AdminShell>
  );
}
