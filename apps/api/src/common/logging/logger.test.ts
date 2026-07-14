import { describe, expect, it } from 'vitest';

import { redactFields } from './logger.js';

describe('redactFields', () => {
  it('redacts sensitive keys while preserving neutral fields', () => {
    const redacted = redactFields({
      correlationId: 'abc',
      password: 'should-not-appear',
      token: 'should-not-appear',
      nested: {
        apiKey: 'should-not-appear',
        action: 'health.check',
      },
    });

    expect(redacted).toEqual({
      correlationId: 'abc',
      password: '[REDACTED]',
      token: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        action: 'health.check',
      },
    });
  });
});
