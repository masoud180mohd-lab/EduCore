'use client';

import { GraduationCap, UserCog, User, School } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { MfaChallengeForm } from '@/components/MfaChallengeForm';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { beginAuth0Login, isAuth0Configured } from '@/lib/auth/auth0-pkce';
import {
  completeLoginFromTokens,
  selectTenantAndFinish,
  verifyMfaAndComplete,
  type TenantChoice,
} from '@/lib/auth/complete-login';

const DEMO_ACCOUNTS = [
  { role: 'admin', label: 'Admin', email: 'admin@educore.test', password: 'Password123!', icon: UserCog },
  { role: 'teacher', label: 'Teacher', email: 'teacher@educore.test', password: 'Password123!', icon: User },
  { role: 'principal', label: 'Principal', email: 'principal@educore.test', password: 'Password123!', icon: School },
  { role: 'student', label: 'Student', email: 'student@educore.test', password: 'Password123!', icon: User },
  { role: 'parent', label: 'Parent', email: 'parent@educore.test', password: 'Password123!', icon: UserCog },
] as const;

type LoginResponse = {
  readonly data?: {
    readonly accessToken?: string;
    readonly tenantId?: string | null;
    readonly mfaChallengeToken?: string | null;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale, theme, setTheme } = useAppPreferences();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auth0Busy, setAuth0Busy] = useState(false);
  const [tenants, setTenants] = useState<ReadonlyArray<TenantChoice> | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [auth0Ready, setAuth0Ready] = useState(false);

  useEffect(() => {
    setAuth0Ready(isAuth0Configured());
  }, []);

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
      setError(t('login.selectSchool'));
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
      else setError(t('login.failed'));
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
      setError(t('login.auth0Missing'));
      setAuth0Busy(false);
    }
  }

  async function onMfaVerify(code: string) {
    if (mfaChallengeToken === null) return;
    setBusy(true);
    setError(null);
    try {
      await handleOutcome(await verifyMfaAndComplete({ mfaChallengeToken, code }));
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(teacherFriendlyMessage(err));
        if (/challenge/i.test(err.message)) setMfaChallengeToken(null);
      } else setError(t('login.mfaFailed'));
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
      else setError(t('login.selectFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_45%),radial-gradient(circle_at_80%_0%,color-mix(in_srgb,var(--color-accent)_12%,transparent),transparent_40%)]"
      />
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 md:right-8 md:top-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
        >
          <span suppressHydrationWarning>{locale === 'en' ? 'SW' : 'EN'}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span suppressHydrationWarning>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </Button>
      </div>

      <Card className="relative z-10 w-full max-w-md animate-rise shadow-[0_24px_60px_-40px_color-mix(in_srgb,var(--color-ink)_45%,transparent)]">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2" suppressHydrationWarning>
            <span
              className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]"
              suppressHydrationWarning
            >
              <GraduationCap aria-hidden className="size-4" suppressHydrationWarning />
            </span>
            <span className="text-xl font-semibold tracking-tight">EduCore</span>
          </div>
          <CardTitle>{t('login.title')}</CardTitle>
          <CardDescription>{t('login.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error !== null ? (
            <div
              className="rounded-lg border border-[var(--color-danger)]/35 bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--card))] px-3 py-2 text-sm text-[var(--color-danger)]"
              role="alert"
            >
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
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--muted-foreground)]">{t('login.chooseSchool')}</p>
              <ul className="flex flex-col gap-2">
                {tenants.map((school) => (
                  <li key={school.id}>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start px-4 py-3 text-left"
                      onClick={() => void bindTenant(school.id)}
                      disabled={busy}
                    >
                      {school.name ?? school.code ?? school.id}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {auth0Ready ? (
                <>
                  <Button
                    type="button"
                    size="lg"
                    disabled={busy || auth0Busy}
                    onClick={() => void onAuth0Click()}
                  >
                    {auth0Busy ? t('login.auth0Busy') : t('login.auth0')}
                  </Button>
                  <p className="text-center text-sm text-[var(--muted-foreground)]">
                    {t('login.orPassword')}
                  </p>
                </>
              ) : null}

              <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t('common.email')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t('common.password')}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tenantId">{t('login.schoolIdOptional')}</Label>
                  <Input
                    id="tenantId"
                    name="tenantId"
                    type="text"
                    placeholder={t('login.schoolIdPlaceholder')}
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  variant={auth0Ready ? 'secondary' : 'default'}
                  disabled={busy || auth0Busy}
                  className="w-full"
                >
                  {busy ? t('login.signingIn') : t('login.signIn')}
                </Button>
              </form>
            </div>
          )}
          {/* Demo accounts */}
          <div className="flex flex-col gap-2 mt-4">
            {DEMO_ACCOUNTS.map((acc) => (
              <Button
                key={acc.role}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                  toast.success(`Filled ${acc.label} demo credentials`);
                }}
              >
                <acc.icon className="mr-2 size-4" />
                {acc.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
