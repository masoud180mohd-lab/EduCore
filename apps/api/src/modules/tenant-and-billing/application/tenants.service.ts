import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AccessibleTenantsRepository } from '../repositories/accessible-tenants.repository.js';

/** Public tenant list item (aligned with ACF Tenant schema fields). */
export type AccessibleTenant = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly primaryLocale: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ListAccessibleTenantsResult = {
  readonly data: ReadonlyArray<AccessibleTenant>;
};

export type GetAccessibleTenantResult = {
  readonly data: AccessibleTenant;
};

/**
 * Product read API for tenants the principal can access (active membership).
 * No write operations.
 */
@Injectable()
export class TenantsService {
  constructor(private readonly accessibleTenants: AccessibleTenantsRepository) {}

  async listForUser(userId: string): Promise<ListAccessibleTenantsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }

    if (!this.accessibleTenants.isAvailable()) {
      // CI / no app pool: fail closed with empty list (not 503 — same as permission defaults).
      return { data: [] };
    }

    const data = await this.accessibleTenants.listAccessibleTenants(userId);
    return { data };
  }

  /**
   * GET /tenants/:id — membership-scoped detail.
   * Missing tenant, no membership, or no pool → 404 (no cross-tenant existence leak).
   */
  async getForUser(userId: string, tenantId: string): Promise<GetAccessibleTenantResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.notFound('Tenant not found.');
    }

    if (!this.accessibleTenants.isAvailable()) {
      throw AppError.notFound('Tenant not found.');
    }

    const tenant = await this.accessibleTenants.getAccessibleTenantById(userId, tenantId);
    if (tenant === null) {
      throw AppError.notFound('Tenant not found.');
    }
    return { data: tenant };
  }
}
