import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  PermissionsRepository,
  type PermissionRow,
} from '../repositories/permissions.repository.js';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissions: PermissionsRepository) {}

  async listForTenant(
    actorUserId: string,
    tenantId: string,
  ): Promise<{ readonly data: ReadonlyArray<PermissionRow> }> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    return { data: this.permissions.isAvailable() ? await this.permissions.list() : [] };
  }
}
