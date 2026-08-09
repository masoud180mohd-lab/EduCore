import type { ApiClientError } from '@/lib/api/client';

export type ApiFriendlyMessageOptions = {
  readonly forbiddenCopy?: string;
  /** Teacher attendance: closed session 409 gets a dedicated message. */
  readonly closedSession409?: boolean;
};

/**
 * Shared HTTP status → user copy for web shells.
 * Domain-specific 403/409 belong in adminFriendlyMessage or shell wrappers.
 */
export function apiFriendlyMessage(
  error: ApiClientError,
  options: ApiFriendlyMessageOptions = {},
): string {
  const forbiddenCopy = options.forbiddenCopy ?? 'You do not have access for this school.';

  if (error.code === 'MFA_INVALID') {
    return 'Invalid or expired authenticator code. Try again.';
  }
  if (error.code === 'MFA_REQUIRED') {
    return 'Authenticator enrollment is required for this account. Ask an admin to keep soft enforce until you enroll under Settings → Security, or enroll before hard enforce is enabled.';
  }

  if (error.status === 401) return 'Sign in again.';
  if (error.status === 403) return forbiddenCopy;
  if (error.status === 404) return 'Not found.';
  if (error.status === 409 && options.closedSession409 && /closed/i.test(error.message)) {
    return 'Session is closed — marking is disabled.';
  }
  if (error.status === 409) return error.message;
  if (error.code === 'IDEMPOTENCY_KEY_REQUIRED') {
    return 'Save failed — retry key missing. Try again.';
  }
  if (error.status === 0) return 'You are offline — queue not enabled yet.';
  return error.message;
}
