import { describe, expect, it } from 'vitest';

import {
  assertPayloadAllowlist,
  normalizeTzMsisdn,
  phoneLast4,
  renderTemplateBody,
} from './notification-templates.js';

describe('notification template helpers', () => {
  it('rejects unknown placeholders', () => {
    expect(() =>
      assertPayloadAllowlist('comms_test_sms', { school_name: 'A', extra: 'x' }),
    ).toThrow(/Unknown placeholder/);
  });

  it('renders allowlisted tokens', () => {
    expect(renderTemplateBody('Hi {{school_name}}', { school_name: 'Dar School' })).toBe(
      'Hi Dar School',
    );
  });

  it('normalizes TZ phones and last4', () => {
    expect(normalizeTzMsisdn('0712345678')).toBe('255712345678');
    expect(normalizeTzMsisdn('+255 712 345 678')).toBe('255712345678');
    expect(normalizeTzMsisdn('12')).toBeNull();
    expect(phoneLast4('255712345678')).toBe('5678');
  });
});
