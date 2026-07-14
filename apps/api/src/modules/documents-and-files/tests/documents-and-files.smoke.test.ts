import { describe, expect, it } from 'vitest';

import { DocumentsAndFilesApplicationService } from '../application/documents-and-files.application-service.js';
import { DocumentsAndFilesDomainService } from '../domain/documents-and-files.domain-service.js';
import { DocumentsAndFilesEventNames } from '../events/documents-and-files.events.js';
import { DocumentsAndFilesModule } from '../documents-and-files.module.js';
import { DocumentsAndFilesPolicy } from '../policies/documents-and-files.policy.js';

describe('Documents And Files module skeleton', () => {
  it('exposes a Nest module definition', () => {
    expect(DocumentsAndFilesModule).toBeDefined();
  });

  it('keeps application wiring non-operational', () => {
    const service = new DocumentsAndFilesApplicationService(
      new DocumentsAndFilesDomainService(),
      new DocumentsAndFilesPolicy(),
      { boundedContext: 'Documents And Files' },
    );

    expect(service.describeSkeleton()).toEqual({
      boundedContext: 'Documents And Files',
      ready: false,
    });
    expect(new DocumentsAndFilesPolicy().isAllowed()).toBe(false);
    expect(DocumentsAndFilesEventNames.skeletonRegistered).toBe(
      'documents-and-files.skeleton.registered',
    );
  });
});
