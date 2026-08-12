/**
 * Admin home hub directory + quick-start deep links (IMP-037).
 * Visibility still comes from `visibleAdminNavIds` — this module only maps copy/hrefs.
 */
import type { AdminNavId } from '@/lib/auth/admin-access';

export type AdminHubCard = {
  readonly id: AdminNavId;
  readonly hrefSuffix: string;
  readonly title: string;
  readonly blurb: string;
};

export const ADMIN_HUB_CARDS: ReadonlyArray<AdminHubCard> = [
  {
    id: 'students',
    hrefSuffix: '/students',
    title: 'Students',
    blurb: 'Registry — search by name/code; filter by status',
  },
  {
    id: 'guardians',
    hrefSuffix: '/guardians',
    title: 'Guardians',
    blurb: 'Parents and student links — search; filter by status',
  },
  {
    id: 'organizations',
    hrefSuffix: '/organizations',
    title: 'Organizations',
    blurb: 'Campuses and units — pick parent from list (no UUID paste)',
  },
  {
    id: 'users',
    hrefSuffix: '/users',
    title: 'Users',
    blurb: 'Invite staff; filter invited / active / disabled',
  },
  {
    id: 'memberships',
    hrefSuffix: '/memberships',
    title: 'Memberships',
    blurb: 'Roster by membership status — open a user for lifecycle',
  },
  {
    id: 'roles',
    hrefSuffix: '/roles',
    title: 'Roles',
    blurb: 'Custom and system roles — open a role to edit permissions',
  },
  {
    id: 'academic',
    hrefSuffix: '/academic',
    title: 'Academic',
    blurb: 'Years through enrollments — filters on every list',
  },
  {
    id: 'fees',
    hrefSuffix: '/fees',
    title: 'Fees',
    blurb: 'Structures by year/status; invoices; office pay; receipts',
  },
  {
    id: 'notifications',
    hrefSuffix: '/notifications',
    title: 'SMS',
    blurb: 'Deliveries, usage, and test send',
  },
  {
    id: 'settings',
    hrefSuffix: '/settings',
    title: 'Settings',
    blurb: 'Tenant settings — prefer the guided form over Advanced JSON',
  },
];

export const ADMIN_HUB_BY_ID = Object.fromEntries(
  ADMIN_HUB_CARDS.map((card) => [card.id, card]),
) as Partial<Record<AdminNavId, AdminHubCard>>;

export type AdminHubQuickStart = {
  readonly id: string;
  /** Must be visible in Admin nav for this link to show. */
  readonly requires: AdminNavId;
  readonly hrefSuffix: string;
  readonly label: string;
  readonly hint: string;
};

/** Deep links that skip intermediate hubs where useful. */
export const ADMIN_HUB_QUICK_STARTS: ReadonlyArray<AdminHubQuickStart> = [
  {
    id: 'add-student',
    requires: 'students',
    hrefSuffix: '/students',
    label: 'Add or find a student',
    hint: 'Create on the list page, or search / filter status',
  },
  {
    id: 'invite-staff',
    requires: 'users',
    hrefSuffix: '/users',
    label: 'Invite staff',
    hint: 'After invite, filter status = invited',
  },
  {
    id: 'enroll',
    requires: 'academic',
    hrefSuffix: '/academic/enrollments',
    label: 'Enroll a student',
    hint: 'Filter by year, student, class, stream, or status',
  },
  {
    id: 'invoices',
    requires: 'fees',
    hrefSuffix: '/fees/invoices',
    label: 'Open invoices',
    hint: 'Draft, issue, filter by student or status',
  },
  {
    id: 'link-guardian',
    requires: 'guardians',
    hrefSuffix: '/guardians',
    label: 'Link a guardian',
    hint: 'Create or open a guardian, then bind students',
  },
  {
    id: 'sms',
    requires: 'notifications',
    hrefSuffix: '/notifications',
    label: 'SMS deliveries',
    hint: 'Usage and test send (when permitted)',
  },
];

export function visibleAdminHubQuickStarts(
  visibleIds: ReadonlySet<AdminNavId>,
): ReadonlyArray<AdminHubQuickStart> {
  return ADMIN_HUB_QUICK_STARTS.filter((item) => visibleIds.has(item.requires));
}
