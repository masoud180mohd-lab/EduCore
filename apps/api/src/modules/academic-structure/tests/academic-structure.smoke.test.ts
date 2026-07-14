import { describe, expect, it } from 'vitest';

import { AcademicStructureApplicationService } from '../application/academic-structure.application-service.js';
import { AcademicStructureDomainService } from '../domain/academic-structure.domain-service.js';
import { AcademicStructureEventNames } from '../events/academic-structure.events.js';
import { AcademicStructureModule } from '../academic-structure.module.js';
import { AcademicStructurePolicy } from '../policies/academic-structure.policy.js';

describe('Academic Structure module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(AcademicStructureModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new AcademicStructureApplicationService(
      new AcademicStructureDomainService(),
      new AcademicStructurePolicy(),
      { boundedContext: 'Academic Structure' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Academic Structure',
      ready: false,
    });
    expect(new AcademicStructurePolicy().isAllowed()).toBe(false);
    expect(AcademicStructureEventNames.skeletonRegistered).toBe(
      'academic-structure.skeleton.registered',
    );
  });
});
