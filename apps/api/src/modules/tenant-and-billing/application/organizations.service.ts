import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  IDEMPOTENCY_STORE,
  resolveIdempotentReplay,
  type IdempotencyStore,
} from '../../../common/idempotency/index.js';
import {
  buildPaginatedResponse,
  parsePaginationQuery,
  type PaginatedResponse,
} from '../../../common/pagination/index.js';
import { parseOptionalSearchFilter } from '../../../common/text/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import {
  OrganizationsRepository,
  type OrganizationRow,
} from '../repositories/organizations.repository.js';

/** Public organization list item (ACF Organization schema). */
export type Organization = OrganizationRow;

export type ListOrganizationsResult = PaginatedResponse<Organization>;

export type GetOrganizationResult = {
  readonly data: Organization;
};

export type CreateOrganizationResult = {
  readonly data: Organization;
};

const ORG_STATUSES = new Set(['active', 'inactive']);
const ORG_TYPES = new Set(['school', 'campus', 'department']);
const CREATE_ROUTE = '/api/v1/organizations';
const CODE_PATTERN = /^[a-z0-9-]{2,64}$/;

/**
 * Product API for organizations in the bound tenant.
 * GET list/detail; POST create (P16).
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizations: OrganizationsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /organizations/:id — membership-scoped detail in bound tenant.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    userId: string,
    tenantId: string,
    organizationId: string,
  ): Promise<GetOrganizationResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(organizationId)) {
      throw AppError.notFound('Organization not found.');
    }

    if (!this.organizations.isAvailable()) {
      throw AppError.notFound('Organization not found.');
    }

    const org = await this.organizations.getByIdForTenant(userId, tenantId, organizationId);
    if (org === null) {
      throw AppError.notFound('Organization not found.');
    }
    return { data: org };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, orgType, search.
   * Response: `{ data, page: { nextCursor, limit } }`.
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly search?: unknown;
      readonly orgType?: unknown;
    },
  ): Promise<ListOrganizationsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const orgType = parseOrgTypeFilter(rawQuery.orgType);
    const search = parseOptionalSearchFilter(rawQuery.search);

    if (!this.organizations.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.organizations.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      search,
      orgType,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * POST /organizations — create (Idempotency-Key required).
   * tenantId always from bound context, never body.
   */
  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateOrganizationResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateOrganizationRequest(rawBody);
    const bodyJson = JSON.stringify({
      orgType: parsed.orgType,
      name: parsed.name,
      ...(parsed.code === undefined ? {} : { code: parsed.code }),
      ...(parsed.parentOrganizationId === undefined
        ? {}
        : { parentOrganizationId: parsed.parentOrganizationId }),
    });

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route: CREATE_ROUTE,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as CreateOrganizationResult;
      }

      const result = await this.executeCreate(actorUserId, tenantId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeCreate(actorUserId, tenantId, parsed, correlationId);
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    parsed: {
      orgType: 'school' | 'campus' | 'department';
      name: string;
      code: string | undefined;
      parentOrganizationId: string | undefined;
    },
    correlationId: string,
  ): Promise<CreateOrganizationResult> {
    if (!this.organizations.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Organization store unavailable.');
    }

    try {
      const org = await this.organizations.createForTenant(actorUserId, tenantId, {
        id: randomUUID(),
        orgType: parsed.orgType,
        name: parsed.name,
        code: parsed.code,
        parentOrganizationId: parsed.parentOrganizationId,
      });
      if (org === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create organization.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'organization.create',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'organization',
          resourceId: org.id,
          metadata: {
            orgType: parsed.orgType,
            ...(parsed.code === undefined ? {} : { code: parsed.code }),
          },
        });
      }

      return { data: org };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'Organization code already exists in this tenant.');
      }
      if (isParentNotFound(error)) {
        throw AppError.notFound('Parent organization not found.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid organization payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create organization.');
    }
  }
}

function parseStatusFilter(raw: unknown): 'active' | 'inactive' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !ORG_STATUSES.has(raw)) {
    throw AppError.validation('status must be active or inactive.', {
      field: 'status',
    });
  }
  return raw as 'active' | 'inactive';
}

function parseOrgTypeFilter(raw: unknown): 'school' | 'campus' | 'department' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !ORG_TYPES.has(raw)) {
    throw AppError.validation('orgType must be school, campus, or department.', {
      field: 'orgType',
    });
  }
  return raw as 'school' | 'campus' | 'department';
}

export function parseCreateOrganizationRequest(raw: unknown): {
  orgType: 'school' | 'campus' | 'department';
  name: string;
  code: string | undefined;
  parentOrganizationId: string | undefined;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['orgType', 'name', 'code', 'parentOrganizationId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  if (typeof body['orgType'] !== 'string' || !ORG_TYPES.has(body['orgType'])) {
    throw AppError.validation('orgType must be school, campus, or department.', {
      field: 'orgType',
    });
  }
  if (typeof body['name'] !== 'string') {
    throw AppError.validation('name is required.', { field: 'name' });
  }
  const name = body['name'].trim();
  if (name.length < 1 || name.length > 200) {
    throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
  }

  let code: string | undefined;
  if (body['code'] !== undefined && body['code'] !== null) {
    if (typeof body['code'] !== 'string') {
      throw AppError.validation('code must be a string.', { field: 'code' });
    }
    code = body['code'].trim();
    if (code === '') {
      code = undefined;
    } else if (!CODE_PATTERN.test(code)) {
      throw AppError.validation('code must match ^[a-z0-9-]{2,64}$.', { field: 'code' });
    }
  }

  let parentOrganizationId: string | undefined;
  if (body['parentOrganizationId'] !== undefined && body['parentOrganizationId'] !== null) {
    if (typeof body['parentOrganizationId'] !== 'string' || !isUuid(body['parentOrganizationId'])) {
      throw AppError.validation('parentOrganizationId must be a uuid.', {
        field: 'parentOrganizationId',
      });
    }
    parentOrganizationId = body['parentOrganizationId'];
  }

  return {
    orgType: body['orgType'] as 'school' | 'campus' | 'department',
    name,
    code,
    parentOrganizationId,
  };
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

function isPgInvalidParameter(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '22023'
  );
}

function isParentNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.toLowerCase().includes('parent organization not found') ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P0002')
  );
}
