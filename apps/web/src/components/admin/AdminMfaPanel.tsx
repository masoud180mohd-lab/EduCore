'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { Banner, ConfirmDialog } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type MfaFactor = {
  readonly id: string;
  readonly factorType: string;
  readonly status: string;
  readonly label: string | null;
  readonly confirmedAt: string | null;
};

type MeMfa = {
  readonly mfaEnrollmentRequired?: boolean;
  readonly mfaEnforced?: 'soft' | 'hard';
  readonly mfaActive?: boolean;
};

type EnrollmentPending = {
  readonly id: string;
  readonly secret: string;
  readonly otpauthUri: string;
};

/**
 * Self-service TOTP enroll / disable (ACF-001 §4.8) — Settings security section.
 */
export function AdminMfaPanel() {
  const { t } = useAppPreferences();
  const [factors, setFactors] = useState<ReadonlyArray<MfaFactor>>([]);
  const [me, setMe] = useState<MeMfa | null>(null);
  const [pending, setPending] = useState<EnrollmentPending | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [disableId, setDisableId] = useState<string | null>(null);
  const [confirmCodeInvalid, setConfirmCodeInvalid] = useState(false);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [factorsRes, meRes] = await Promise.all([
        apiRequest<{ data: ReadonlyArray<MfaFactor> }>('/api/v1/me/mfa-factors', {
          auth,
          requireTenant: false,
        }),
        apiRequest<{ data: MeMfa }>('/api/v1/auth/me', { auth }),
      ]);
      setFactors(factorsRes.data ?? []);
      setMe(meRes.data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError(t('mfa.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function beginEnroll() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = 'mfa.begin-totp';
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{
        data: MfaFactor & { secret: string; otpauthUri: string };
      }>('/api/v1/me/mfa-factors', {
        method: 'POST',
        auth,
        requireTenant: false,
        body: { factorType: 'totp', label: t('mfa.authenticator') },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setPending({
        id: result.data.id,
        secret: result.data.secret,
        otpauthUri: result.data.otpauthUri,
      });
      setConfirmCode('');
      setConfirmCodeInvalid(false);
      setInfo(t('mfa.scanInfo'));
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError(t('mfa.startError'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(event: FormEvent) {
    event.preventDefault();
    if (pending === null) return;
    const auth = readSession();
    if (auth === null) return;
    const code = confirmCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setConfirmCodeInvalid(true);
      setError(t('mfa.enterCode'));
      return;
    }
    setBusy(true);
    setConfirmCodeInvalid(false);
    setError(null);
    setInfo(null);
    try {
      await apiRequest(`/api/v1/me/mfa-factors/${pending.id}/confirm`, {
        method: 'POST',
        auth,
        requireTenant: false,
        body: { code },
      });
      setPending(null);
      setConfirmCode('');
      setInfo(t('mfa.enrolled'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'MFA_INVALID') {
          setConfirmCodeInvalid(true);
          setError(t('mfa.invalidCode'));
        } else setError(adminFriendlyMessage(err, 'settings'));
      } else setError(t('mfa.confirmError'));
    } finally {
      setBusy(false);
    }
  }

  async function disableFactor(factorId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await apiRequest(`/api/v1/me/mfa-factors/${factorId}/disable`, {
        method: 'POST',
        auth,
        requireTenant: false,
        body: {},
      });
      setDisableId(null);
      setInfo(t('mfa.disabled'));
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError(t('mfa.disableError'));
    } finally {
      setBusy(false);
    }
  }

  const active = factors.filter((f) => f.status === 'active');
  const hasActive = active.length > 0 || me?.mfaActive === true;

  return (
    <section className="stack card" style={{ marginTop: '1.5rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('mfa.title')}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t('mfa.description')}
      </p>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {loading ? <p className="muted">{t('mfa.loading')}</p> : null}

      {!loading && me !== null ? (
        <p className="muted" style={{ margin: 0 }}>
          {t('mfa.enforcement')}{' '}
          <strong>
            {me.mfaEnforced === 'hard' ? t('mfa.enforcedHard') : t('mfa.enforcedSoft')}
          </strong>
          {me.mfaEnrollmentRequired
            ? me.mfaEnforced === 'hard'
              ? t('mfa.enrollRequired')
              : t('mfa.enrollRecommended')
            : null}
          {hasActive ? t('mfa.activeNow') : t('mfa.noneActive')}
        </p>
      ) : null}

      {!loading && pending === null && !hasActive ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void beginEnroll()}
        >
          {busy ? t('common.starting') : t('mfa.enroll')}
        </button>
      ) : null}

      {!loading && pending !== null ? (
        <form className="stack" onSubmit={(e) => void confirmEnroll(e)}>
          <p>{t('mfa.setupHint')}</p>
          <div className="field">
            <label htmlFor="otpauthUri">{t('mfa.setupLink')}</label>
            <textarea
              id="otpauthUri"
              readOnly
              rows={3}
              value={pending.otpauthUri}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}
            />
            <p style={{ margin: '0.5rem 0 0' }}>
              <a href={pending.otpauthUri}>{t('mfa.openAuthenticator')}</a>
            </p>
          </div>
          <div className="field">
            <label htmlFor="totpSecret">{t('mfa.manualSecret')}</label>
            <input
              id="totpSecret"
              readOnly
              value={pending.secret}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
            />
          </div>
          <div className="field">
            <label htmlFor="confirmMfa">{t('mfa.confirmCode')}</label>
            <input
              id="confirmMfa"
              inputMode="numeric"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={6}
              required
              value={confirmCode}
              disabled={busy}
              aria-invalid={confirmCodeInvalid}
              onChange={(e) => {
                setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setConfirmCodeInvalid(false);
              }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || confirmCode.trim().length !== 6}
          >
            {busy ? t('common.confirming') : t('mfa.confirmEnroll')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setPending(null);
              setConfirmCode('');
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      ) : null}

      {!loading && active.length > 0 ? (
        <ul className="list">
          {active.map((f) => (
            <li key={f.id}>
              <div className="stack" style={{ gap: '0.5rem' }}>
                <span>
                  {t('mfa.factorActive', { label: f.label ?? t('mfa.authenticator') })}
                  {f.confirmedAt !== null
                    ? ` ${t('mfa.since', { date: new Date(f.confirmedAt).toLocaleDateString() })}`
                    : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setDisableId(f.id)}
                >
                  {t('mfa.disable')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={disableId !== null}
        title={t('mfa.disableTitle')}
        body={
          me?.mfaEnforced === 'hard' && active.length === 1
            ? t('mfa.disableBodyHard')
            : t('mfa.disableBody')
        }
        confirmLabel={t('common.disable')}
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setDisableId(null);
        }}
        onConfirm={() => {
          if (disableId !== null) void disableFactor(disableId);
        }}
      />
    </section>
  );
}
