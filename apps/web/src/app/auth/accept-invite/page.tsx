'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, type FormEvent, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Lock, Mail, School, ShieldCheck, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { writeSession } from '@/lib/auth/session';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';
  const tenantIdParam = searchParams.get('tenantId') ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Nywila lazima iwe na angalau herufi 8.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Nywila hazilingani. Tafadhali hakiki tena.');
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest<{
        data: {
          accessToken: string;
          tokenType: string;
          expiresIn: number;
          user: { id: string; email: string; displayName: string };
          tenantId: string;
        };
      }>('/api/v1/auth/accept-invite', {
        method: 'POST',
        requireTenant: false,
        body: {
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim() === '' ? undefined : displayName.trim(),
          tenantId: tenantIdParam.trim() === '' ? undefined : tenantIdParam.trim(),
        },
      });

      const data = response.data;
      if (data.accessToken) {
        writeSession({
          accessToken: data.accessToken,
          tenantId: data.tenantId ?? '',
        });
      }

      setCompleted(true);
      setTimeout(() => {
        if (data.tenantId) {
          router.replace(`/t/${data.tenantId}/admin`);
        } else {
          router.replace('/login');
        }
      }, 1500);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Imeshindikana kupokea mwaliko. Tafadhali jaribu tena.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (completed) {
    return (
      <Card className="w-full max-w-md border-emerald-500/20 bg-card/95 shadow-xl backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="h-8 w-8 animate-bounce" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Karibu EduCore!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Akaunti yako imethibitishwa na umeanza kutumia mfumo rasmi. Unaelekezwa sasa...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/60 bg-card/95 shadow-2xl backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <School className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Pokea Mwaliko</CardTitle>
        <CardDescription className="text-sm">
          Weka jina lako na nywila mpya ili kujiunga na mfumo wa shule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Barua Pepe (Email)
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mfano@shule.ac.tz"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="displayName"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Jina Kamili (Hiari)
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Mwalimu Juma Hamisi"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Nywila Mpya
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Angalau herufi 8"
                className="pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Rudia Nywila
            </Label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Rudia nywila yako"
                className="pl-9"
              />
            </div>
          </div>

          <Button type="submit" disabled={busy} className="mt-2 w-full font-medium">
            {busy ? 'Inathibitisha...' : 'Kamilisha na Ingia'}
          </Button>

          <div className="pt-2 text-center text-xs text-muted-foreground">
            Una akaunti tayari?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Ingia hapa
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background p-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Inapakia...</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
