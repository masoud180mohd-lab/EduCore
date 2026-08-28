'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import type { PlatformTenantDetail } from '@/lib/platform/types';

type Step = 'school' | 'owner' | 'confirm';

export default function RegisterSchoolPage() {
  const router = useRouter();
  const { t } = useAppPreferences();
  const [step, setStep] = useState<Step>('school');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [primaryLocale, setPrimaryLocale] = useState<'en' | 'sw'>('en');
  const [timezone, setTimezone] = useState('Africa/Dar_es_Salaam');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerDisplayName, setOwnerDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onSchool(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStep('owner');
  }

  function onOwner(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStep('confirm');
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `platform.tenant.register:${code}`;
    try {
      const result = await apiRequest<{ data: PlatformTenantDetail }>('/api/v1/platform/tenants', {
        method: 'POST',
        auth,
        requireTenant: false,
        idempotencyKey: readOrCreateIdempotencyKey(actionKey),
        body: {
          code: code.trim(),
          name: name.trim(),
          primaryLocale,
          timezone: timezone.trim(),
          owner: { email: ownerEmail.trim(), displayName: ownerDisplayName.trim() },
        },
      });
      clearIdempotencyKey(actionKey);
      router.replace(`/platform/tenants/${result.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) setError(t('platform.forbidden'));
      else if (err instanceof ApiClientError) setError(err.message);
      else setError(t('platform.registerError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <AdminPageHeader title={t('platform.register')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      <p className="muted">
        {step === 'school'
          ? t('platform.stepSchool')
          : step === 'owner'
            ? t('platform.stepOwner')
            : t('platform.stepConfirm')}
      </p>

      {step === 'school' ? (
        <form className="stack" onSubmit={onSchool}>
          <label>
            {t('platform.code')}
            <input
              value={code}
              required
              minLength={3}
              maxLength={64}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label>
            {t('platform.name')}
            <input
              value={name}
              required
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t('platform.locale')}
            <select
              value={primaryLocale}
              onChange={(e) => setPrimaryLocale(e.target.value as 'en' | 'sw')}
            >
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </label>
          <label>
            {t('platform.timezone')}
            <input value={timezone} required onChange={(e) => setTimezone(e.target.value)} />
          </label>
          <div className="actions">
            <Link className="btn btn-secondary" href="/platform">
              {t('common.back')}
            </Link>
            <button type="submit" className="btn btn-primary">
              {t('platform.next')}
            </button>
          </div>
        </form>
      ) : null}

      {step === 'owner' ? (
        <form className="stack" onSubmit={onOwner}>
          <label>
            {t('platform.ownerEmail')}
            <input
              type="email"
              value={ownerEmail}
              required
              maxLength={320}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </label>
          <label>
            {t('platform.ownerName')}
            <input
              value={ownerDisplayName}
              required
              maxLength={200}
              onChange={(e) => setOwnerDisplayName(e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('school')}>
              {t('common.back')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('platform.next')}
            </button>
          </div>
        </form>
      ) : null}

      {step === 'confirm' ? (
        <form className="stack" onSubmit={onConfirm}>
          <dl className="definition-list">
            <dt>{t('platform.code')}</dt>
            <dd>{code}</dd>
            <dt>{t('platform.name')}</dt>
            <dd>{name}</dd>
            <dt>{t('platform.locale')}</dt>
            <dd>{primaryLocale}</dd>
            <dt>{t('platform.timezone')}</dt>
            <dd>{timezone}</dd>
            <dt>{t('platform.ownerEmail')}</dt>
            <dd>{ownerEmail}</dd>
            <dt>{t('platform.ownerName')}</dt>
            <dd>{ownerDisplayName}</dd>
          </dl>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStep('owner')}>
              {t('common.back')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('common.working') : t('platform.registerConfirm')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
