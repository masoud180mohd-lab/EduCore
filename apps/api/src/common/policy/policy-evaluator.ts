import { Injectable, Inject } from '@nestjs/common';

import { AppError } from '../errors/app-error.js';
import type { PermissionCode } from './permission-codes.js';

/**
 * Loads effective permission codes for (user, tenant).
 * Production: membership + roles + role_permissions (Identity And Access).
 * Default: empty set (deny-by-default).
 */
export interface PermissionSource {
  getPermissions(userId: string, tenantId: string): Promise<ReadonlySet<string>>;
}

export const PERMISSION_SOURCE = Symbol('PERMISSION_SOURCE');

export class EmptyPermissionSource implements PermissionSource {
  getPermissions(_userId: string, _tenantId: string): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set());
  }
}

/**
 * Static map for unit tests: key `${userId}::${tenantId}` → permission codes.
 */
export class MapPermissionSource implements PermissionSource {
  constructor(private readonly map: ReadonlyMap<string, ReadonlySet<string>>) {}

  getPermissions(userId: string, tenantId: string): Promise<ReadonlySet<string>> {
    return Promise.resolve(this.map.get(`${userId}::${tenantId}`) ?? new Set());
  }
}

/**
 * Foundation policy evaluator (IMP-001-T18).
 * Explicit deny default; checks permission codes only (no org-scope yet).
 */
@Injectable()
export class PolicyEvaluator {
  constructor(@Inject(PERMISSION_SOURCE) private readonly source: PermissionSource) {}

  async hasPermission(
    userId: string,
    tenantId: string,
    permission: PermissionCode,
  ): Promise<boolean> {
    const perms = await this.source.getPermissions(userId, tenantId);
    return perms.has(permission);
  }

  async requirePermission(
    userId: string,
    tenantId: string,
    permission: PermissionCode,
  ): Promise<void> {
    const allowed = await this.hasPermission(userId, tenantId, permission);
    if (!allowed) {
      throw AppError.forbidden('Missing required permission.', { permission });
    }
  }

  async requireAny(
    userId: string,
    tenantId: string,
    permissions: ReadonlyArray<PermissionCode>,
  ): Promise<void> {
    const perms = await this.source.getPermissions(userId, tenantId);
    if (!permissions.some((p) => perms.has(p))) {
      throw AppError.forbidden('Missing required permission.', {
        permissions: [...permissions],
      });
    }
  }
}
