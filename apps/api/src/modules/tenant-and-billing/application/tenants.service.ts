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
 * List is an unpaginated picker envelope (`{ data }`) with a soft safety cap in the repository.
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

  /**
   * PATCH /tenants/current or /tenants/:id — update bound tenant profile.
   */
  async updateForTenant(
    userId: string,
    tenantId: string,
    rawBody: unknown,
  ): Promise<GetAccessibleTenantResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.notFound('Tenant not found.');
    }

    if (!this.accessibleTenants.isAvailable()) {
      throw AppError.notFound('Tenant not found.');
    }

    if (typeof rawBody !== 'object' || rawBody === null) {
      throw AppError.validation('Request body is required.');
    }

    const body = rawBody as Record<string, unknown>;
    const name = typeof body['name'] === 'string' ? body['name'].trim() : undefined;
    if (name !== undefined && (name.length < 2 || name.length > 200)) {
      throw AppError.validation('name must be between 2 and 200 characters.', { field: 'name' });
    }
    const timezone = typeof body['timezone'] === 'string' ? body['timezone'].trim() : undefined;
    if (timezone !== undefined && (timezone.length < 2 || timezone.length > 80)) {
      throw AppError.validation('timezone is invalid.', { field: 'timezone' });
    }
    const primaryLocale =
      typeof body['primaryLocale'] === 'string' ? body['primaryLocale'].trim() : undefined;
    if (primaryLocale !== undefined && primaryLocale !== 'en' && primaryLocale !== 'sw') {
      throw AppError.validation('primaryLocale must be en or sw.', { field: 'primaryLocale' });
    }

    if (name === undefined && timezone === undefined && primaryLocale === undefined) {
      throw AppError.validation(
        'At least one field (name, timezone, primaryLocale) must be provided.',
      );
    }

    const tenant = await this.accessibleTenants.updateTenantProfile(userId, tenantId, {
      ...(name !== undefined ? { name } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
      ...(primaryLocale !== undefined ? { primaryLocale } : {}),
    });

    if (tenant === null) {
      throw AppError.notFound('Tenant not found.');
    }

    return { data: tenant };
  }
}
