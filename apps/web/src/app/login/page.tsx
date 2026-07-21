'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { writeSession } from '@/lib/auth/session';

type LoginResponse = {
  readonly data?: {
    readonly accessToken?: string;
    readonly tenantId?: string | null;
    readonly mfaChallengeToken?: string | null;
  };
};

type TenantList = {
  readonly data: ReadonlyArray<{
    readonly id: string;
    readonly name?: string;
    readonly code?: string;
  }>;
};

async function fetchAccessibleTenants(accessToken: string): Promise<TenantList['data']> {
  const base = (process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const response = await fetch(`${base}/api/v1/tenants`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = (await response.json()) as TenantList & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new ApiClientError({
      status: response.status,
      code: 'HTTP_ERROR',
      message: json.error?.message ?? 'Could not load schools.',
    });
  }
  return json.data ?? [];
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tenants, setTenants] = useState<TenantList['data'] | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  async function finish(accessToken: string, boundTenant: string) {
    writeSession({ accessToken, tenantId: boundTenant });
    router.replace(`/t/${boundTenant}/teacher`);
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

      if (result.data?.mfaChallengeToken) {
        setError('MFA is not supported in teacher v1. Ask an admin for a non-MFA account.');
        return;
      }

      const accessToken = result.data?.accessToken;
      if (accessToken === undefined || accessToken === '') {
        setError('Login failed — no access token returned.');
        return;
      }

      let boundTenant = result.data?.tenantId ?? null;
      if (boundTenant === null || boundTenant === '') {
        const list = await fetchAccessibleTenants(accessToken);
        if (list.length === 0) {
          setError('No school membership found for this account.');
          return;
        }
        if (list.length === 1) {
          boundTenant = list[0]?.id ?? null;
        } else {
          setPendingToken(accessToken);
          setTenants(list);
          setError('Select a school to continue.');
          return;
        }
      }

      if (boundTenant === null || boundTenant === '') {
        setError('Could not bind a school (tenant).');
        return;
      }

      await finish(accessToken, boundTenant);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function bindTenant(id: string) {
    if (pendingToken === null) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/v1/auth/select-tenant', {
        method: 'POST',
        body: { tenantId: id },
        auth: { accessToken: pendingToken, tenantId: id },
      });
      await finish(pendingToken, id);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not select school.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <h1>Teacher sign in</h1>
      <p className="muted">EduCore attendance — staff accounts with attendance permissions.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

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
      ) : (
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
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}
