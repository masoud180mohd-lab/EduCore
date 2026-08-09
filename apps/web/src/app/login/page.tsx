'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { MfaChallengeForm } from '@/components/MfaChallengeForm';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { beginAuth0Login, isAuth0Configured } from '@/lib/auth/auth0-pkce';
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auth0Busy, setAuth0Busy] = useState(false);
  const [tenants, setTenants] = useState<ReadonlyArray<TenantChoice> | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const auth0Ready = isAuth0Configured();

  async function handleOutcome(
    outcome: Awaited<ReturnType<typeof completeLoginFromTokens>>,
  ): Promise<void> {
    if (outcome.kind === 'routed') {
      router.replace(outcome.path);
      return;
    }
    if (outcome.kind === 'choose_tenant') {
      setPendingToken(outcome.accessToken);
      setTenants(outcome.tenants);
      setMfaChallengeToken(null);
      setError('Select a school to continue.');
      return;
    }
    if (outcome.kind === 'mfa_required') {
      setMfaChallengeToken(outcome.mfaChallengeToken);
      setTenants(null);
      setPendingToken(null);
      setError(null);
      return;
    }
    setError(outcome.message);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, string> = { email, password };
      if (tenantId.trim() !== '') body['tenantId'] = tenantId.trim();

      const result = await apiRequest<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body,
        requireTenant: false,
      });

      await handleOutcome(
        await completeLoginFromTokens({
          accessToken: result.data?.accessToken ?? '',
          tenantId: result.data?.tenantId ?? null,
          mfaChallengeToken: result.data?.mfaChallengeToken ?? null,
        }),
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onAuth0Click() {
    setError(null);
    setAuth0Busy(true);
    try {
      await beginAuth0Login();
    } catch {
      setError('Auth0 is not configured for this web build.');
      setAuth0Busy(false);
    }
  }

  async function onMfaVerify(code: string) {
    if (mfaChallengeToken === null) return;
    setBusy(true);
    setError(null);
    try {
      await handleOutcome(
        await verifyMfaAndComplete({ mfaChallengeToken, code }),
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('MFA verification failed.');
    } finally {
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <h1>Sign in</h1>
      <p className="muted">EduCore — staff, admin, and parent accounts.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {mfaChallengeToken !== null ? (
        <MfaChallengeForm
          busy={busy}
          onSubmit={onMfaVerify}
          onCancel={() => {
            setMfaChallengeToken(null);
            setError(null);
          }}
        />
      ) : tenants !== null ? (
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
      ) : (
        <div className="stack">
          {auth0Ready ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || auth0Busy}
                onClick={() => void onAuth0Click()}
              >
                {auth0Busy ? 'Redirecting…' : 'Ingia na Auth0'}
              </button>
              <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
                or email / password
              </p>
            </>
          ) : null}

          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="tenantId">School id (optional)</label>
              <input
                id="tenantId"
                name="tenantId"
                type="text"
                placeholder="UUID if you know it"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className={auth0Ready ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={busy || auth0Busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
