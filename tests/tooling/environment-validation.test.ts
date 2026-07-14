import { describe, expect, it } from 'vitest';

import { parseNodeEnvironment, validateEnvironment } from '../../scripts/validate-environment.js';

describe('environment validation', () => {
  it('defaults NODE_ENV to development when it is unset', () => {
    expect(parseNodeEnvironment(undefined)).toBe('development');
  });

  it('defaults NODE_ENV to development when it is empty', () => {
    expect(parseNodeEnvironment('')).toBe('development');
  });

  it.each(['development', 'test', 'production'] as const)('accepts the %s environment', (value) => {
    expect(validateEnvironment({ NODE_ENV: value })).toBe(value);
  });

  it('rejects an unsupported environment without echoing its value', () => {
    const sensitive = 'super-secret-value-should-not-leak';

    expect(() => parseNodeEnvironment(sensitive)).toThrow(
      'NODE_ENV must be one of: development, test, production.',
    );

    try {
      parseNodeEnvironment(sensitive);
      expect.unreachable('expected parseNodeEnvironment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(sensitive);
    }
  });
});
