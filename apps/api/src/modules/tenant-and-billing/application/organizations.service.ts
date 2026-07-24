import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  assertIdempotencyKey,
  buildIdempotencyScopeKey,
  hashRequestBody,
  IDEMPOTENCY_STORE,
  parseIdempotencyKey,
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

export type PatchOrganizationResult = {
  readonly data: Organization;
};

export type DeactivateOrganizationResult = {
  readonly data: Organization;
};

const ORG_STATUSES = new Set(['active', 'inactive']);
const ORG_TYPES = new Set(['school', 'campus', 'department']);
const CREATE_ROUTE = '/api/v1/organizations';
const PATCH_ROUTE_PREFIX = '/api/v1/organizations/';
const DEACTIVATE_ROUTE_SUFFIX = '/deactivate';
const CODE_PATTERN = /^[a-z0-9-]{2,64}$/;

/**
 * Product API for organizations in the bound tenant.
 * GET list/detail; POST create (P16); PATCH + deactivate (IMP-016).
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

  /**
   * PATCH /organizations/:id — partial update (organization.manage).
   * Fields: name, code (null clears), parentOrganizationId (null clears).
   * Idempotency-Key optional.
   */
  async patchForTenant(
    actorUserId: string,
    tenantId: string,
    organizationId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PatchOrganizationResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(organizationId)) {
      throw AppError.notFound('Organization not found.');
    }

    const parsed = parsePatchOrganizationRequest(rawBody);
    const bodyJson = JSON.stringify({
      ...(parsed.setName ? { name: parsed.name } : {}),
      ...(parsed.setCode ? { code: parsed.code } : {}),
      ...(parsed.setParent ? { parentOrganizationId: parsed.parentOrganizationId } : {}),
    });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'PATCH',
          route: `${PATCH_ROUTE_PREFIX}${organizationId}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as PatchOrganizationResult;
      }

      const result = await this.executePatch(
        actorUserId,
        tenantId,
        organizationId,
        parsed,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executePatch(actorUserId, tenantId, organizationId, parsed, correlationId);
  }

  /**
   * POST /organizations/:id/deactivate — status → inactive (organization.manage).
   * Idempotent. Idempotency-Key optional.
   */
  async deactivateForTenant(
    actorUserId: string,
    tenantId: string,
    organizationId: string,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<DeactivateOrganizationResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(organizationId)) {
      throw AppError.notFound('Organization not found.');
    }

    const bodyJson = '{}';
    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined && this.idempotency !== null) {
      const key = assertIdempotencyKey(optionalKey);
      const scopeKey = buildIdempotencyScopeKey(
        {
          actorUserId,
          tenantId,
          method: 'POST',
          route: `${PATCH_ROUTE_PREFIX}${organizationId}${DEACTIVATE_ROUTE_SUFFIX}`,
        },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as DeactivateOrganizationResult;
      }

      const result = await this.executeDeactivate(
        actorUserId,
        tenantId,
        organizationId,
        correlationId,
      );
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 200,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeDeactivate(actorUserId, tenantId, organizationId, correlationId);
  }

  private async executePatch(
    actorUserId: string,
    tenantId: string,
    organizationId: string,
    parsed: ParsedOrganizationPatch,
    correlationId: string,
  ): Promise<PatchOrganizationResult> {
    if (!this.organizations.isAvailable()) {
      throw AppError.notFound('Organization not found.');
    }

    try {
      const org = await this.organizations.updateForTenant(actorUserId, tenantId, organizationId, {
        setName: parsed.setName,
        name: parsed.name,
        setCode: parsed.setCode,
        code: parsed.code,
        setParent: parsed.setParent,
        parentOrganizationId: parsed.parentOrganizationId,
      });
      if (org === null) {
        throw AppError.notFound('Organization not found.');
      }

      if (this.audit !== null) {
        const fields: string[] = [];
        if (parsed.setName) fields.push('name');
        if (parsed.setCode) fields.push('code');
        if (parsed.setParent) fields.push('parentOrganizationId');
        await this.audit.publish({
          action: 'organization.patch',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'organization',
          resourceId: organizationId,
          metadata: { fields },
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
      throw new AppError('INTERNAL_ERROR', 'Failed to update organization.');
    }
  }

  private async executeDeactivate(
    actorUserId: string,
    tenantId: string,
    organizationId: string,
    correlationId: string,
  ): Promise<DeactivateOrganizationResult> {
    if (!this.organizations.isAvailable()) {
      throw AppError.notFound('Organization not found.');
    }

    try {
      const org = await this.organizations.deactivateForTenant(
        actorUserId,
        tenantId,
        organizationId,
      );
      if (org === null) {
        throw AppError.notFound('Organization not found.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'organization.deactivate',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'organization',
          resourceId: organizationId,
        });
      }

      return { data: org };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to deactivate organization.');
    }
  }
}

type ParsedOrganizationPatch = {
  setName: boolean;
  name: string | undefined;
  setCode: boolean;
  code: string | null | undefined;
  setParent: boolean;
  parentOrganizationId: string | null | undefined;
};

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

/**
 * UpdateOrganizationRequest: optional name, code, parentOrganizationId (nullable).
 * At least one field required. Unknown keys rejected. No orgType/status.
 */
export function parsePatchOrganizationRequest(raw: unknown): ParsedOrganizationPatch {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['name', 'code', 'parentOrganizationId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  let setName = false;
  let name: string | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    setName = true;
    if (typeof body['name'] !== 'string') {
      throw AppError.validation('name must be a string.', { field: 'name' });
    }
    name = body['name'].trim();
    if (name.length < 1 || name.length > 200) {
      throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
    }
  }

  let setCode = false;
  let code: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'code')) {
    setCode = true;
    if (body['code'] === null) {
      code = null;
    } else if (typeof body['code'] === 'string') {
      const trimmed = body['code'].trim();
      if (trimmed === '') {
        code = null;
      } else if (!CODE_PATTERN.test(trimmed)) {
        throw AppError.validation('code must match ^[a-z0-9-]{2,64}$.', { field: 'code' });
      } else {
        code = trimmed;
      }
    } else {
      throw AppError.validation('code must be a string or null.', { field: 'code' });
    }
  }

  let setParent = false;
  let parentOrganizationId: string | null | undefined;
  if (Object.prototype.hasOwnProperty.call(body, 'parentOrganizationId')) {
    setParent = true;
    if (body['parentOrganizationId'] === null) {
      parentOrganizationId = null;
    } else if (
      typeof body['parentOrganizationId'] === 'string' &&
      isUuid(body['parentOrganizationId'])
    ) {
      parentOrganizationId = body['parentOrganizationId'];
    } else {
      throw AppError.validation('parentOrganizationId must be a uuid or null.', {
        field: 'parentOrganizationId',
      });
    }
  }

  if (!setName && !setCode && !setParent) {
    throw AppError.validation('At least one of name, code, parentOrganizationId is required.');
  }

  return { setName, name, setCode, code, setParent, parentOrganizationId };
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
