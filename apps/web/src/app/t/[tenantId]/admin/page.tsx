'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import {
  ADMIN_HUB_BY_ID,
  visibleAdminHubQuickStarts,
  type AdminHubCard,
} from '@/lib/admin/admin-hub';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { groupAdminNav, visibleAdminNavIds, type AdminNavId } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { readSession } from '@/lib/auth/session';
import { groupMessageKey } from '@/lib/i18n/messages';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

type MeEnvelope = {
  readonly data: MeLike;
};

export default function AdminHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const [school, setSchool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [navIds, setNavIds] = useState<ReadonlySet<AdminNavId> | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [tenant, me] = await Promise.all([
          apiRequest<TenantCurrent>('/api/v1/tenants/current', { auth }),
          apiRequest<MeEnvelope>('/api/v1/auth/me', { auth }),
        ]);
        setSchool(tenant.data.name ?? tenant.data.code ?? tenant.data.id);
        setNavIds(visibleAdminNavIds(me.data));
      } catch (err) {
        if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'tenant'));
        else setError('Could not load school.');
      }
    })();
  }, []);

  const base = `/t/${tenantId}/admin`;
  const loading = navIds === null && error === null;
  const groups = navIds === null ? [] : groupAdminNav(navIds).filter((g) => g.id !== 'home');
  const areaCards = groups.flatMap((group) =>
    group.items
      .map((id) => ADMIN_HUB_BY_ID[id])
      .filter((card): card is AdminHubCard => card !== undefined),
  );
  const quickStarts = navIds === null ? [] : visibleAdminHubQuickStarts(navIds);
  const emptyAreas = !loading && error === null && areaCards.length === 0;

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title={t('hub.title')}
        description={
          school !== null ? `${school} — ${t('hub.description')}` : t('hub.loadingSchool')
        }
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">{t('hub.loadingAreas')}</p> : null}
      {emptyAreas ? <Banner tone="info">{t('hub.emptyAreas')}</Banner> : null}

      {quickStarts.length > 0 ? (
        <section className="admin-hub-quick" aria-labelledby="admin-hub-quick-heading">
          <h2 id="admin-hub-quick-heading" className="admin-hub-group-label">
            {t('hub.quickStarts')}
          </h2>
          <ul className="list admin-hub-quick-list">
            {quickStarts.map((item) => (
              <li key={item.id}>
                <Link className="card" href={`${base}${item.hrefSuffix}`}>
                  <strong>{item.label}</strong>
                  <div className="muted">{item.hint}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !emptyAreas ? (
        <ul className="admin-hub-groups">
          {groups.map((group) => {
            const cards = group.items
              .map((id) => ADMIN_HUB_BY_ID[id])
              .filter((card): card is AdminHubCard => card !== undefined);
            if (cards.length === 0) return null;
            return (
              <li key={group.id} className="admin-hub-group">
                <h2 className="admin-hub-group-label">{t(groupMessageKey(group.id))}</h2>
                <ul className="list">
                  {cards.map((card) => (
                    <li key={card.id}>
                      <Link className="card" href={`${base}${card.hrefSuffix}`}>
                        <strong>{card.title}</strong>
                        <div className="muted">{card.blurb}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AdminShell>
  );
}
