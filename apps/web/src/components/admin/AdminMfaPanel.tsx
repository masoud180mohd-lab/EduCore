'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { Banner, ConfirmDialog } from '@/components/admin';
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
  const [factors, setFactors] = useState<ReadonlyArray<MfaFactor>>([]);
  const [me, setMe] = useState<MeMfa | null>(null);
  const [pending, setPending] = useState<EnrollmentPending | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [disableId, setDisableId] = useState<string | null>(null);

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
      else setError('Could not load MFA status.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        body: { factorType: 'totp', label: 'Authenticator' },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setPending({
        id: result.data.id,
        secret: result.data.secret,
        otpauthUri: result.data.otpauthUri,
      });
      setConfirmCode('');
      setInfo('Scan or enter the secret in your authenticator, then confirm with a code.');
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError('Could not start MFA enrollment.');
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
      setError('Enter a 6-digit authenticator code.');
      return;
    }
    setBusy(true);
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
      setInfo('Authenticator enrolled. You will need a code at the next sign-in.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'MFA_INVALID') setError('Invalid authenticator code. Try again.');
        else setError(adminFriendlyMessage(err, 'settings'));
      } else setError('Could not confirm MFA enrollment.');
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
      setInfo('Authenticator disabled.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'settings'));
      else setError('Could not disable MFA.');
    } finally {
      setBusy(false);
    }
  }

  const active = factors.filter((f) => f.status === 'active');
  const hasActive = active.length > 0 || me?.mfaActive === true;

  return (
    <section className="stack card" style={{ marginTop: '1.5rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Security — authenticator (MFA)</h2>
      <p className="muted" style={{ margin: 0 }}>
        Privileged accounts should enroll TOTP under soft enforce before staging flips to{' '}
        <code>MFA_ENFORCE=hard</code>.
      </p>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {loading ? <p className="muted">Loading MFA…</p> : null}

      {!loading && me !== null ? (
        <p className="muted" style={{ margin: 0 }}>
          Mode: <strong>{me.mfaEnforced ?? 'soft'}</strong>
          {me.mfaEnrollmentRequired ? ' — enrollment recommended for your role.' : null}
          {hasActive ? ' — authenticator active.' : ' — no active authenticator.'}
        </p>
      ) : null}

      {!loading && pending === null && !hasActive ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void beginEnroll()}>
          {busy ? 'Starting…' : 'Enroll authenticator'}
        </button>
      ) : null}

      {!loading && pending !== null ? (
        <form className="stack" onSubmit={(e) => void confirmEnroll(e)}>
          <p>
            Add this account in your authenticator app. Prefer opening the otpauth link on your
            phone, or enter the secret manually.
          </p>
          <div className="field">
            <label htmlFor="otpauthUri">otpauth URI</label>
            <textarea
              id="otpauthUri"
              readOnly
              rows={3}
              value={pending.otpauthUri}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}
            />
            <p style={{ margin: '0.5rem 0 0' }}>
              <a href={pending.otpauthUri}>Open in authenticator</a>
            </p>
          </div>
          <div className="field">
            <label htmlFor="totpSecret">Manual secret</label>
            <input
              id="totpSecret"
              readOnly
              value={pending.secret}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
            />
          </div>
          <div className="field">
            <label htmlFor="confirmMfa">Confirm with 6-digit code</label>
            <input
              id="confirmMfa"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={confirmCode}
              disabled={busy}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || confirmCode.trim().length !== 6}
          >
            {busy ? 'Confirming…' : 'Confirm enrollment'}
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
            Cancel
          </button>
        </form>
      ) : null}

      {!loading && active.length > 0 ? (
        <ul className="list">
          {active.map((f) => (
            <li key={f.id}>
              <div className="stack" style={{ gap: '0.5rem' }}>
                <span>
                  {f.label ?? f.factorType} — active
                  {f.confirmedAt !== null ? ` since ${f.confirmedAt}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setDisableId(f.id)}
                >
                  Disable authenticator
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={disableId !== null}
        title="Disable authenticator?"
        body="You will no longer be asked for a code at sign-in. Re-enroll before MFA_ENFORCE=hard if you are privileged."
        confirmLabel="Disable"
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
