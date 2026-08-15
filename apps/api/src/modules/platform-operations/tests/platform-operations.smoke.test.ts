import { describe, expect, it } from 'vitest';

import { PlatformOperationsEventNames } from '../events/platform-operations.events.js';
import { PlatformOperationsModule } from '../platform-operations.module.js';
import { PlatformOperationsPolicy } from '../policies/platform-operations.policy.js';

describe('Platform Operations module', () => {
  it('exposes a Nest module definition', () => {
    expect(PlatformOperationsModule).toBeDefined();
  });

  it('keeps the unused policy deny-by-default', () => {
    expect(new PlatformOperationsPolicy().isAllowed()).toBe(false);
    expect(PlatformOperationsEventNames.skeletonRegistered).toBe(
      'platform-operations.skeleton.registered',
    );
  });
});
