import type { ApiClientError } from '../api/client';
import { apiFriendlyMessage } from '../api/api-friendly-message';

export type AdminErrorDomain =
  | 'generic'
  | 'users'
  | 'memberships'
  | 'organizations'
  | 'students'
  | 'guardians'
  | 'roles'
  | 'academic'
  | 'finance'
  | 'settings'
  | 'tenant';

/** @deprecated Use AdminErrorDomain */
export type AdminDomain = Exclude<AdminErrorDomain, 'generic'>;

export type AdminFriendlyMessageOptions = {
  readonly action?: 'reconcile' | 'invite';
};

const ACTION_403 = 'You do not have access for this action.';
const FINANCE_403 = 'You do not have finance access.';
const FINANCE_RECONCILE_403 = 'You do not have finance reconcile access.';
const TENANT_403 = 'You do not have access for this school.';

function domain403(
  domain: AdminErrorDomain,
  action?: AdminFriendlyMessageOptions['action'],
): string {
  if (domain === 'tenant') return TENANT_403;
  if (domain === 'finance') {
    return action === 'reconcile' ? FINANCE_RECONCILE_403 : FINANCE_403;
  }
  return ACTION_403;
}

function domain409Fallback(domain: AdminErrorDomain): string | undefined {
  switch (domain) {
    case 'students':
      return 'Conflict — duplicate student code.';
    case 'users':
      return 'Conflict — membership already exists.';
    case 'organizations':
      return 'Conflict — organization code already in use.';
    case 'roles':
      return 'Conflict — role or assignment already exists.';
    case 'guardians':
      return 'Conflict — duplicate email or link.';
    case 'academic':
      return 'Conflict — duplicate code or state.';
    case 'finance':
      return 'Fee structure items are in use by invoices.';
    default:
      return undefined;
  }
}

/**
 * Central admin error copy (IMP-035 / DSF-002).
 * Maps ApiClientError only — API remains AuthZ truth.
 */
export function adminFriendlyMessage(
  err: ApiClientError,
  domain: AdminErrorDomain,
  options?: AdminFriendlyMessageOptions,
): string {
  if (err.status === 403) return domain403(domain, options?.action);
  if (err.status === 409) {
    const trimmed = err.message.trim();
    if (trimmed !== '') return err.message;
    const fallback = domain409Fallback(domain);
    if (fallback !== undefined) return fallback;
  }
  return apiFriendlyMessage(err, { forbiddenCopy: domain403(domain, options?.action) });
}
