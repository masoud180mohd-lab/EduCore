import { describe, expect, it } from 'vitest';

import {
  InMemoryAuditPublisher,
  redactAuditMetadata,
  sanitizeAuditEvent,
} from './audit-publisher.js';

describe('AuditPublisher foundation', () => {
  it('redacts password and token fields from metadata', () => {
    expect(
      redactAuditMetadata({
        email: 'a@example.com',
        password: 'super-secret',
        accessToken: 'tok',
        nested: { refreshToken: 'r' },
      }),
    ).toEqual({
      email: 'a@example.com',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]' },
    });
  });

  it('appends sanitized events in memory', async () => {
    const publisher = new InMemoryAuditPublisher();
    await publisher.publish({
      action: 'auth.login',
      outcome: 'failure',
      correlationId: 'corr-1',
      metadata: { password: 'x', reason: 'invalid' },
    });

    expect(publisher.events).toHaveLength(1);
    const event = publisher.events[0];
    expect(event?.metadata).toEqual({ password: '[REDACTED]', reason: 'invalid' });
    expect(event?.occurredAt).toBeDefined();
  });

  it('sanitizeAuditEvent stamps occurredAt', () => {
    const event = sanitizeAuditEvent({
      action: 'tenant.created',
      outcome: 'success',
      correlationId: 'c',
    });
    expect(event.occurredAt).toMatch(/^\d{4}-/);
  });
});
