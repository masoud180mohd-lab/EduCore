import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  TenantSettingsRepository,
  type TenantSettingsRow,
} from '../repositories/tenant-settings.repository.js';

/** Public settings document (ACF TenantSettingsEnvelope data shape). */
export type TenantSettingsDocument = TenantSettingsRow;

export type GetTenantSettingsResult = {
  readonly data: TenantSettingsDocument;
};

/**
 * Product read API for the bound tenant settings document.
 * Missing document → 404 (no silent empty invent; no PUT in this increment).
 */
@Injectable()
export class TenantSettingsService {
  constructor(private readonly tenantSettings: TenantSettingsRepository) {}

  async getForTenant(userId: string, tenantId: string): Promise<GetTenantSettingsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    if (!this.tenantSettings.isAvailable()) {
      throw AppError.notFound('Tenant settings not found.');
    }

    const settings = await this.tenantSettings.getForTenant(userId, tenantId);
    if (settings === null) {
      throw AppError.notFound('Tenant settings not found.');
    }
    return { data: settings };
  }
}
