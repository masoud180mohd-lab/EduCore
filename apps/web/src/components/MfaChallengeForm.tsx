'use client';

import { type FormEvent, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';

type Props = {
  readonly busy?: boolean;
  readonly onSubmit: (code: string) => void | Promise<void>;
  readonly onCancel?: () => void;
};

/**
 * Login-time TOTP challenge (ACF-001 / MFA-004) — shared by password + Auth0 paths.
 */
export function MfaChallengeForm({ busy = false, onSubmit, onCancel }: Props) {
  const { t } = useAppPreferences();
  const [code, setCode] = useState('');
  const [invalidCode, setInvalidCode] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setInvalidCode(true);
      return;
    }
    setInvalidCode(false);
    void onSubmit(trimmed);
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <p>{t('login.mfaBody')}</p>
      <div className="field">
        <label htmlFor="mfaCode">{t('login.mfaCode')}</label>
        <input
          id="mfaCode"
          name="mfaCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          spellCheck={false}
          maxLength={6}
          required
          value={code}
          disabled={busy}
          aria-invalid={invalidCode}
          aria-describedby={invalidCode ? 'mfaCodeError' : undefined}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setInvalidCode(false);
          }}
        />
        {invalidCode ? (
          <p id="mfaCodeError" role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {t('mfa.enterCode')}
          </p>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length !== 6}>
        {busy ? t('login.verifying') : t('login.verify')}
      </button>
      {onCancel !== undefined ? (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          {t('common.cancel')}
        </button>
      ) : null}
    </form>
  );
}
