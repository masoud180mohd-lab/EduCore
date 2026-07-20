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
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import {
  MembershipsRepository,
  type MembershipRow,
} from '../repositories/memberships.repository.js';

/** Public membership list item (ACF Membership core fields; nested user deferred). */
export type Membership = MembershipRow;

export type ListMembershipsResult = PaginatedResponse<Membership>;

export type GetMembershipResult = {
  readonly data: Membership;
};

export type CreateMembershipResult = {
  readonly data: Membership;
};

const MEMBERSHIP_STATUSES = new Set(['invited', 'active', 'suspended', 'removed']);
const SYSTEM_ROLE_CODES = new Set(['owner', 'admin', 'staff']);
const CREATE_ROUTE = '/api/v1/memberships';
// Practical email shape; full RFC not required for product invite.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Product API for memberships in the bound tenant.
 * Scope: tenant roster (ACF 4.6). GET list/detail; POST invite (P15).
 */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly memberships: MembershipsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  /**
   * GET /memberships/:id — membership detail in bound tenant only.
   * Missing, other-tenant, invalid id, or no pool → 404 (no existence leak).
   */
  async getForTenant(
    userId: string,
    tenantId: string,
    membershipId: string,
  ): Promise<GetMembershipResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
    if (!isUuid(membershipId)) {
      throw AppError.notFound('Membership not found.');
    }

    if (!this.memberships.isAvailable()) {
      throw AppError.notFound('Membership not found.');
    }

    const membership = await this.memberships.getByIdForTenant(userId, tenantId, membershipId);
    if (membership === null) {
      throw AppError.notFound('Membership not found.');
    }
    return { data: membership };
  }

  /**
   * Cursor list with optional filters.
   * Query: limit (1–100, default 25), cursor, status, userId.
   * Response: `{ data, page: { nextCursor, limit } }`.
   */
  async listForTenant(
    userId: string,
    tenantId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
      readonly userId?: unknown;
    },
  ): Promise<ListMembershipsResult> {
    if (!isUuid(userId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const pagination = parsePaginationQuery(rawQuery);
    const status = parseStatusFilter(rawQuery.status);
    const filterUserId = parseUserIdFilter(rawQuery.userId);

    if (!this.memberships.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }

    const page = await this.memberships.listForTenant(userId, tenantId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
      userId: filterUserId,
    });

    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  /**
   * POST /memberships — invite by email (Idempotency-Key required).
   */
  async inviteForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<CreateMembershipResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateMembershipRequest(rawBody);
    const bodyJson = JSON.stringify({
      email: parsed.email,
      ...(parsed.displayName === undefined ? {} : { displayName: parsed.displayName }),
      ...(parsed.roleCodes.length === 0 ? {} : { roleCodes: parsed.roleCodes }),
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
        return JSON.parse(replay.responseBody) as CreateMembershipResult;
      }

      const result = await this.executeInvite(actorUserId, tenantId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeInvite(actorUserId, tenantId, parsed, correlationId);
  }

  private async executeInvite(
    actorUserId: string,
    tenantId: string,
    parsed: {
      email: string;
      displayName: string | undefined;
      roleCodes: ReadonlyArray<string>;
    },
    correlationId: string,
  ): Promise<CreateMembershipResult> {
    if (!this.memberships.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Membership store unavailable.');
    }

    try {
      const membership = await this.memberships.inviteForTenant(actorUserId, tenantId, {
        membershipId: randomUUID(),
        newUserId: randomUUID(),
        email: parsed.email,
        displayName: parsed.displayName,
        roleCodes: parsed.roleCodes,
      });
      if (membership === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create membership.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'membership.invite',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'membership',
          resourceId: membership.id,
          metadata: {
            inviteeUserId: membership.userId,
            roleCodes: [...parsed.roleCodes],
          },
        });
      }

      return { data: membership };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isPgUniqueViolation(error) || isMembershipConflict(error)) {
        throw new AppError('CONFLICT', 'Membership already exists for this user in the tenant.');
      }
      if (isPgInvalidParameter(error)) {
        throw AppError.validation('Invalid invite payload.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to create membership.');
    }
  }
}

function parseStatusFilter(
  raw: unknown,
): 'invited' | 'active' | 'suspended' | 'removed' | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !MEMBERSHIP_STATUSES.has(raw)) {
    throw AppError.validation('status must be invited, active, suspended, or removed.', {
      field: 'status',
    });
  }
  return raw as 'invited' | 'active' | 'suspended' | 'removed';
}

function parseUserIdFilter(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw.trim())) {
    throw AppError.validation('userId must be a uuid.', { field: 'userId' });
  }
  return raw.trim().toLowerCase();
}

export function parseCreateMembershipRequest(raw: unknown): {
  email: string;
  displayName: string | undefined;
  roleCodes: ReadonlyArray<string>;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['email', 'displayName', 'roleCodes']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  if (!('email' in body) || typeof body['email'] !== 'string') {
    throw AppError.validation('email is required.', { field: 'email' });
  }
  const email = body['email'].trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw AppError.validation('email must be a valid email address.', { field: 'email' });
  }

  let displayName: string | undefined;
  if (body['displayName'] !== undefined && body['displayName'] !== null) {
    if (typeof body['displayName'] !== 'string') {
      throw AppError.validation('displayName must be a string.', { field: 'displayName' });
    }
    displayName = body['displayName'].trim();
    if (displayName.length < 1 || displayName.length > 200) {
      throw AppError.validation('displayName must be 1–200 characters.', {
        field: 'displayName',
      });
    }
  }

  let roleCodes: string[] = [];
  if (body['roleCodes'] !== undefined && body['roleCodes'] !== null) {
    if (!Array.isArray(body['roleCodes'])) {
      throw AppError.validation('roleCodes must be an array of strings.', { field: 'roleCodes' });
    }
    roleCodes = body['roleCodes'].map((code, index) => {
      if (typeof code !== 'string' || !SYSTEM_ROLE_CODES.has(code)) {
        throw AppError.validation(`roleCodes[${String(index)}] must be owner, admin, or staff.`, {
          field: 'roleCodes',
        });
      }
      return code;
    });
  }

  return { email, displayName, roleCodes };
}

function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

function isMembershipConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('membership already exists');
}

function isPgInvalidParameter(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '22023'
  );
}
