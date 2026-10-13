'use client';

/**
 * WEB-AUTH0 callback — Auth0 redirects here with ?code=&state=
 * Exchanges code via EduCore login (PKCE verifier) → opaque session (or MFA challenge).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { MfaChallengeForm } from '@/components/MfaChallengeForm';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearPkcePending, PKCE_MAX_AGE_MS, readPkcePending } from '@/lib/auth/auth0-pkce';
import {
  completeLoginFromTokens,
  selectTenantAndFinish,
  verifyMfaAndComplete,
  type TenantChoice,
} from '@/lib/auth/complete-login';

type LoginResponse = {
  readonly data?: {
    readonly accessToken?: string;
    readonly tenantId?: string | null;
    readonly mfaChallengeToken?: string | null;
  };
};

export default function Auth0CallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [tenants, setTenants] = useState<ReadonlyArray<TenantChoice> | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error');
        if (oauthError !== null && oauthError !== '') {
          const desc = params.get('error_description') ?? oauthError;
          clearPkcePending();
          setError(`Auth0 login cancelled or failed: ${desc}`);
          setBusy(false);
          return;
        }

        const code = params.get('code');
        const state = params.get('state');
        if (code === null || code === '' || state === null || state === '') {
          clearPkcePending();
          setError('Auth0 callback missing code or state.');
          setBusy(false);
          return;
        }

        const pending = readPkcePending();
        if (pending === null) {
          setError('Auth0 login session expired. Start again from the sign-in page.');
          setBusy(false);
          return;
        }
        if (pending.state !== state) {
          clearPkcePending();
          setError('Auth0 state mismatch. Start again from the sign-in page.');
          setBusy(false);
          return;
        }
        if (Date.now() - pending.createdAt > PKCE_MAX_AGE_MS) {
          clearPkcePending();
          setError('Auth0 login timed out. Start again from the sign-in page.');
          setBusy(false);
          return;
        }

        const result = await apiRequest<LoginResponse>('/api/v1/auth/login', {
          method: 'POST',
          body: {
            idpAssertion: {
              code,
              redirectUri: pending.redirectUri,
              codeVerifier: pending.codeVerifier,
            },
          },
          requireTenant: false,
        });
        clearPkcePending();

        const outcome = await completeLoginFromTokens({
          accessToken: result.data?.accessToken ?? '',
          tenantId: result.data?.tenantId ?? null,
          mfaChallengeToken: result.data?.mfaChallengeToken ?? null,
        });

        if (outcome.kind === 'routed') {
          router.replace(outcome.path);
          return;
        }
        if (outcome.kind === 'choose_tenant') {
          setPendingToken(outcome.accessToken);
          setTenants(outcome.tenants);
          setError('Select a school to continue.');
          setBusy(false);
          return;
        }
        if (outcome.kind === 'mfa_required') {
          setMfaChallengeToken(outcome.mfaChallengeToken);
          setBusy(false);
          return;
        }
        setError(outcome.message);
        setBusy(false);
      } catch (err) {
        clearPkcePending();
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Auth0 sign-in failed.');
        setBusy(false);
      }
    })();
  }, [router]);

  async function onMfaVerify(code: string) {
    if (mfaChallengeToken === null) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await verifyMfaAndComplete({ mfaChallengeToken, code });
      if (outcome.kind === 'routed') {
        router.replace(outcome.path);
        return;
      }
      if (outcome.kind === 'choose_tenant') {
        setMfaChallengeToken(null);
        setPendingToken(outcome.accessToken);
        setTenants(outcome.tenants);
        setError('Select a school to continue.');
        setBusy(false);
        return;
      }
      if (outcome.kind === 'mfa_required') {
        setMfaChallengeToken(outcome.mfaChallengeToken);
        setBusy(false);
        return;
      }
      setError(outcome.message);
      setBusy(false);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('MFA verification failed.');
      setBusy(false);
    }
  }

  async function bindTenant(id: string) {
    if (pendingToken === null) return;
    setBusy(true);
    setError(null);
    try {
      const path = await selectTenantAndFinish(pendingToken, id);
      router.replace(path);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not select school.');
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AdminPageHeader
        title="Auth0 sign-in"
        description={
          mfaChallengeToken !== null
            ? 'Authenticator required to finish EduCore session.'
            : 'Completing EduCore session after Auth0…'
        }
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {busy && tenants === null && mfaChallengeToken === null ? (
        <p className="muted">Please wait…</p>
      ) : null}

      {mfaChallengeToken !== null ? <MfaChallengeForm busy={busy} onSubmit={onMfaVerify} /> : null}

      {tenants !== null ? (
        <div className="stack">
          <p>Choose your school:</p>
          <ul className="list">
            {tenants.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="card"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => void bindTenant(t.id)}
                  disabled={busy}
                >
                  {t.name ?? t.code ?? t.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!busy && mfaChallengeToken === null ? (
        <p style={{ marginTop: '1.5rem' }}>
          <Link className="btn btn-secondary" href="/login">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
