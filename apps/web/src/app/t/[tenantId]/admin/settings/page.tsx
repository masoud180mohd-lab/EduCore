'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

const KNOWN_KEYS = ['timezone', 'locale', 'currency'] as const;

type TenantSettingsDoc = {
  readonly schemaVersion: number;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly updatedAt?: string;
};

function splitSettings(settings: Readonly<Record<string, unknown>>): {
  timezone: string;
  locale: string;
  currency: string;
  extrasJson: string;
} {
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(k)) extras[k] = v;
  }
  return {
    timezone: typeof settings['timezone'] === 'string' ? settings['timezone'] : '',
    locale: typeof settings['locale'] === 'string' ? settings['locale'] : '',
    currency: typeof settings['currency'] === 'string' ? settings['currency'] : '',
    extrasJson: JSON.stringify(extras, null, 2),
  };
}

export default function AdminSettingsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [currency, setCurrency] = useState('');
  const [extrasJson, setExtrasJson] = useState('{}');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const result = await apiRequest<{ data: TenantSettingsDoc }>('/api/v1/tenant-settings', {
        auth,
      });
      const data = result.data;
      setSchemaVersion(data.schemaVersion);
      setUpdatedAt(data.updatedAt ?? null);
      const split = splitSettings(data.settings ?? {});
      setTimezone(split.timezone);
      setLocale(split.locale);
      setCurrency(split.currency);
      setExtrasJson(split.extrasJson);
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

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    let extras: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(extrasJson);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Additional settings must be a JSON object.');
        setBusy(false);
        return;
      }
      extras = parsed as Record<string, unknown>;
    } catch {
      setError('Additional settings JSON is invalid.');
      setBusy(false);
      return;
    }

    const settings: Record<string, unknown> = { ...extras };
    if (timezone.trim() !== '') settings['timezone'] = timezone.trim();
    else delete settings['timezone'];
    if (locale.trim() !== '') settings['locale'] = locale.trim();
    else delete settings['locale'];
    if (currency.trim() !== '') settings['currency'] = currency.trim();
    else delete settings['currency'];

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
      const split = splitSettings(result.data.settings ?? {});
      setTimezone(split.timezone);
      setLocale(split.locale);
      setCurrency(split.currency);
      setExtrasJson(split.extrasJson);
      setSchemaVersion(result.data.schemaVersion);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError('Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Settings</h1>
      <p className="muted">
        Tenant settings document (schemaVersion {schemaVersion}). Save replaces the settings object.
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
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading ? (
        <form className="stack card" onSubmit={(e) => void onSave(e)}>
          <div className="field">
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Africa/Dar_es_Salaam"
            />
          </div>
          <div className="field">
            <label htmlFor="locale">Locale</label>
            <input
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="e.g. en-TZ"
            />
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="e.g. TZS"
            />
          </div>
          <div className="field">
            <label htmlFor="extrasJson">Additional settings (JSON object)</label>
            <textarea
              id="extrasJson"
              rows={8}
              value={extrasJson}
              onChange={(e) => setExtrasJson(e.target.value)}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
            />
          </div>
          {updatedAt !== null ? <p className="muted">Last updated: {updatedAt}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      ) : null}
    </AdminShell>
  );
}
