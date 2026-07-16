import { describe, expect, it, vi } from 'vitest';

import type { AppLogger } from './logger.js';
import { logFailClosedDbError } from './fail-closed-log.js';

describe('logFailClosedDbError', () => {
  it('no-ops when logger is absent', () => {
    expect(() => logFailClosedDbError(null, 'test', new Error('x'))).not.toThrow();
    expect(() => logFailClosedDbError(undefined, 'test', new Error('x'))).not.toThrow();
  });

  it('warns with redacted-safe fields and truncated message', () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() } satisfies AppLogger;
    const long = 'e'.repeat(300);
    logFailClosedDbError(logger, 'PgPermissionSource', new Error(long), {
      operation: 'getPermissions',
    });
    expect(warn).toHaveBeenCalledOnce();
    const [message, fields] = warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toContain('failed closed');
    expect(fields['component']).toBe('PgPermissionSource');
    expect(fields['reason']).toBe('db_error');
    expect(fields['errorName']).toBe('Error');
    expect(String(fields['errorMessage']).length).toBeLessThanOrEqual(180);
    expect(fields['operation']).toBe('getPermissions');
  });
});
