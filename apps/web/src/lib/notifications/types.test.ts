import { describe, expect, it } from 'vitest';

import { formatPhoneLast4, payloadKeysForTemplate, requestStatusLabel, shortId } from './types.js';

describe('notifications types helpers', () => {
  it('never formats full MSISDN — last4 only', () => {
    expect(formatPhoneLast4('5678')).toBe('····5678');
    expect(formatPhoneLast4(null)).toBe('—');
  });

  it('returns allowlist for known templates', () => {
    expect(payloadKeysForTemplate('comms_test_sms')).toEqual(['school_name']);
    expect(payloadKeysForTemplate('unknown_tpl')).toEqual([]);
  });

  it('labels skipped with reason', () => {
    expect(requestStatusLabel('skipped', 'no_phone')).toBe('skipped (no_phone)');
    expect(requestStatusLabel('sent', null)).toBe('sent');
  });

  it('shortens ids', () => {
    expect(shortId('01900000-0000-7000-8000-0000000000aa').startsWith('01900000')).toBe(true);
  });
});
