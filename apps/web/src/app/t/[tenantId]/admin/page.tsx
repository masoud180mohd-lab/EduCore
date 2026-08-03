'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { groupAdminNav, visibleAdminNavIds, type AdminNavId } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { readSession } from '@/lib/auth/session';

type TenantCurrent = {
  readonly data: { readonly id: string; readonly name?: string; readonly code?: string };
};

type MeEnvelope = {
  readonly data: MeLike;
};

type HubCard = {
  readonly id: AdminNavId;
  readonly hrefSuffix: string;
  readonly title: string;
  readonly blurb: string;
};

const HUB_CARDS: ReadonlyArray<HubCard> = [
  { id: 'users', hrefSuffix: '/users', title: 'Users', blurb: 'Staff directory' },
  {
    id: 'memberships',
    hrefSuffix: '/memberships',
    title: 'Memberships',
    blurb: 'Roster by status',
  },
  {
    id: 'organizations',
    hrefSuffix: '/organizations',
    title: 'Organizations',
    blurb: 'Campuses and units',
  },
  { id: 'students', hrefSuffix: '/students', title: 'Students', blurb: 'Student registry' },
  { id: 'guardians', hrefSuffix: '/guardians', title: 'Guardians', blurb: 'Parents and links' },
  { id: 'roles', hrefSuffix: '/roles', title: 'Roles', blurb: 'Permissions and assignments' },
  {
    id: 'academic',
    hrefSuffix: '/academic',
    title: 'Academic',
    blurb: 'Years, classes, subjects, enrollments',
  },
  {
    id: 'fees',
    hrefSuffix: '/fees',
    title: 'Fees',
    blurb: 'Structures, invoices, office payments',
  },
  {
    id: 'notifications',
    hrefSuffix: '/notifications',
    title: 'SMS',
    blurb: 'Deliveries, usage, and test SMS',
  },
  { id: 'settings', hrefSuffix: '/settings', title: 'Settings', blurb: 'Tenant settings document' },
];

const HUB_BY_ID = Object.fromEntries(HUB_CARDS.map((c) => [c.id, c])) as Partial<
  Record<AdminNavId, HubCard>
>;

export default function AdminHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
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
  const groups = navIds === null ? [] : groupAdminNav(navIds).filter((g) => g.id !== 'home');

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Admin</h1>
      <p className="muted">{school !== null ? school : 'Loading school…'}</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <ul className="admin-hub-groups">
        {groups.map((group) => {
          const cards = group.items
            .map((id) => HUB_BY_ID[id])
            .filter((card): card is HubCard => card !== undefined);
          if (cards.length === 0) return null;
          return (
            <li key={group.id} className="admin-hub-group">
              <h2 className="admin-hub-group-label">{group.label}</h2>
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
    </AdminShell>
  );
}
