import { describe, expect, it } from 'vitest';

import { formatUserBindLabel } from './bind-user-label.js';

describe('formatUserBindLabel', () => {
  it('prefers displayName with email', () => {
    expect(
      formatUserBindLabel({
        id: '01900000-0010-7000-8000-000000000099',
        displayName: 'Asha Parent',
        email: 'parent@educore.local',
      }),
    ).toBe('Asha Parent (parent@educore.local)');
  });

  it('falls back to email then truncated id', () => {
    expect(
      formatUserBindLabel({
        id: '01900000-0010-7000-8000-000000000099',
        displayName: null,
        email: 'only@educore.local',
      }),
    ).toBe('only@educore.local');
    expect(
      formatUserBindLabel({
        id: '01900000-0010-7000-8000-000000000099',
        displayName: '',
        email: null,
      }),
    ).toBe('01900000…');
  });
});
