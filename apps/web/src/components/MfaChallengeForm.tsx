'use client';

import { type FormEvent, useState } from 'react';

type Props = {
  readonly busy?: boolean;
  readonly onSubmit: (code: string) => void | Promise<void>;
  readonly onCancel?: () => void;
};

/**
 * Login-time TOTP challenge (ACF-001 / MFA-004) — shared by password + Auth0 paths.
 */
export function MfaChallengeForm({ busy = false, onSubmit, onCancel }: Props) {
  const [code, setCode] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) return;
    void onSubmit(trimmed);
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <p>
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>
      <div className="field">
        <label htmlFor="mfaCode">Authenticator code</label>
        <input
          id="mfaCode"
          name="mfaCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          disabled={busy}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length !== 6}>
        {busy ? 'Verifying…' : 'Verify and continue'}
      </button>
      {onCancel !== undefined ? (
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </form>
  );
}
