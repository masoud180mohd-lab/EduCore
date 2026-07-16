/**
 * Safe ops visibility for fail-closed AuthZ/membership DB paths.
 * Never logs secrets, connection strings, or full stacks.
 */
import type { AppLogger, LogFields } from '../logging/logger.js';

export function logFailClosedDbError(
  logger: AppLogger | null | undefined,
  component: string,
  error: unknown,
  fields: LogFields = {},
): void {
  if (logger === null || logger === undefined) {
    return;
  }

  const err = error instanceof Error ? error : undefined;
  const rawMessage = err?.message ?? String(error);
  logger.warn(`${component} failed closed (denying access)`, {
    component,
    reason: 'db_error',
    errorName: err?.name ?? 'unknown',
    // Cap length; avoid dumping query text / connection URLs if present.
    errorMessage: rawMessage.slice(0, 180),
    ...fields,
  });
}
