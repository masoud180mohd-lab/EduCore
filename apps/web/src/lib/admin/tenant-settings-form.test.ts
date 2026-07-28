import { describe, expect, it } from 'vitest';

import {
  extrasJsonChanged,
  extrasToJson,
  mergeSettingsForSave,
  splitKnownSettings,
  validateExtrasJson,
} from './tenant-settings-form.js';

describe('splitKnownSettings', () => {
  it('splits known keys from extras', () => {
    const { known, extras } = splitKnownSettings({
      timezone: 'Africa/Dar_es_Salaam',
      locale: 'en-TZ',
      currency: 'TZS',
      customFlag: true,
    });
    expect(known).toEqual({
      timezone: 'Africa/Dar_es_Salaam',
      locale: 'en-TZ',
      currency: 'TZS',
    });
    expect(extras).toEqual({ customFlag: true });
  });
});

describe('mergeSettingsForSave', () => {
  it('preserves extras when saving known keys only', () => {
    const merged = mergeSettingsForSave(
      { customFlag: true, legacy: 'keep' },
      { timezone: 'Africa/Dar_es_Salaam', locale: 'en-TZ', currency: 'TZS' },
    );
    expect(merged).toEqual({
      customFlag: true,
      legacy: 'keep',
      timezone: 'Africa/Dar_es_Salaam',
      locale: 'en-TZ',
      currency: 'TZS',
    });
  });

  it('removes empty known keys but keeps extras', () => {
    const merged = mergeSettingsForSave(
      { customFlag: true },
      { timezone: '', locale: 'en-TZ', currency: '' },
    );
    expect(merged).toEqual({ customFlag: true, locale: 'en-TZ' });
    expect(merged).not.toHaveProperty('timezone');
    expect(merged).not.toHaveProperty('currency');
  });
});

describe('validateExtrasJson', () => {
  it('accepts object and rejects invalid', () => {
    expect(validateExtrasJson('{"a":1}')).toEqual({ ok: true, extras: { a: 1 } });
    expect(validateExtrasJson('[]').ok).toBe(false);
    expect(validateExtrasJson('not json').ok).toBe(false);
  });
});

describe('extrasJsonChanged', () => {
  it('detects semantic changes', () => {
    expect(extrasJsonChanged('{"a":1}', '{"a":1}')).toBe(false);
    expect(extrasJsonChanged('{"a":2}', '{"a":1}')).toBe(true);
  });
});

describe('extrasToJson', () => {
  it('pretty-prints extras', () => {
    expect(extrasToJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});
