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
import {
  ENTITLEMENT_CODES,
  PlatformTenantsRepository,
  type EntitlementCode,
  type PlatformAuditRow,
  type PlatformPlanRow,
  type PlatformTenantDetail,
  type PlatformTenantListRow,
} from '../repositories/platform-tenants.repository.js';

const TENANT_STATUSES = new Set(['draft', 'active', 'suspended', 'closed']);
const LOCALES = new Set(['en', 'sw']);
const CODE_PATTERN = /^[a-z0-9-]{3,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTER_ROUTE = '/api/v1/platform/tenants';

export type ListPlatformTenantsResult = PaginatedResponse<PlatformTenantListRow>;
export type GetPlatformTenantResult = { readonly data: PlatformTenantDetail };
export type RegisterPlatformTenantResult = { readonly data: PlatformTenantDetail };
export type ListPlatformPlansResult = { readonly data: ReadonlyArray<PlatformPlanRow> };
export type ListPlatformAuditResult = PaginatedResponse<PlatformAuditRow>;

@Injectable()
export class PlatformOperationsApplicationService {
  constructor(
    private readonly tenants: PlatformTenantsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
  ) {}

  async listTenants(
    actorUserId: string,
    rawQuery: { readonly limit?: unknown; readonly cursor?: unknown; readonly status?: unknown },
  ): Promise<ListPlatformTenantsResult> {
    assertActor(actorUserId);
    const pagination = parsePaginationQuery(rawQuery);
    const status = parseOptionalEnum(rawQuery.status, TENANT_STATUSES, 'status');
    if (!this.tenants.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.tenants.listTenants(actorUserId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      status,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getTenant(actorUserId: string, tenantId: string): Promise<GetPlatformTenantResult> {
    assertActor(actorUserId);
    if (!isUuid(tenantId)) {
      throw AppError.notFound('School not found.');
    }
    if (!this.tenants.isAvailable()) {
      throw AppError.notFound('School not found.');
    }
    const tenant = await this.tenants.getTenant(actorUserId, tenantId);
    if (tenant === null) {
      throw AppError.notFound('School not found.');
    }
    return { data: tenant };
  }

  async registerTenant(
    actorUserId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<RegisterPlatformTenantResult> {
    assertActor(actorUserId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseRegisterBody(rawBody);
    const bodyJson = JSON.stringify(parsed);

    if (!this.tenants.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Platform store unavailable.', 503);
    }

    if (this.idempotency !== null) {
      const scopeKey = buildIdempotencyScopeKey(
        { actorUserId, tenantId: 'platform', method: 'POST', route: REGISTER_ROUTE },
        key,
      );
      const bodyHash = hashRequestBody(bodyJson);
      const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
      if (replay !== null) {
        return JSON.parse(replay.responseBody) as RegisterPlatformTenantResult;
      }
      const result = await this.executeRegister(actorUserId, parsed, correlationId);
      await this.idempotency.put(scopeKey, {
        bodyHash,
        statusCode: 201,
        responseBody: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      });
      return result;
    }

    return this.executeRegister(actorUserId, parsed, correlationId);
  }

  async suspendTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    return this.changeStatus(actorUserId, tenantId, 'suspended', rawBody, correlationId);
  }

  async reinstateTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    return this.changeStatus(actorUserId, tenantId, 'active', rawBody, correlationId);
  }

  async listPlans(actorUserId: string): Promise<ListPlatformPlansResult> {
    assertActor(actorUserId);
    if (!this.tenants.isAvailable()) {
      return { data: [] };
    }
    return { data: await this.tenants.listPlans(actorUserId) };
  }

  async assignPlan(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    assertActor(actorUserId);
    if (!isUuid(tenantId)) {
      throw AppError.notFound('School not found.');
    }
    const parsed = parsePlanBody(rawBody);
    if (!this.tenants.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Platform store unavailable.', 503);
    }
    try {
      const tenant = await this.tenants.assignPlan(
        actorUserId,
        tenantId,
        parsed.planCode,
        parsed.reason,
        correlationId,
      );
      if (tenant === null) {
        throw AppError.notFound('School not found.');
      }
      return { data: tenant };
    } catch (error) {
      if (isCoded(error, 'PLAN_NOT_FOUND')) {
        throw AppError.validation('Unknown plan code.', { field: 'planCode' });
      }
      throw error;
    }
  }

  async setEntitlement(
    actorUserId: string,
    tenantId: string,
    code: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    assertActor(actorUserId);
    if (!isUuid(tenantId)) {
      throw AppError.notFound('School not found.');
    }
    if (!isEntitlementCode(code)) {
      throw AppError.validation('Unknown entitlement code.', { field: 'code' });
    }
    const parsed = parseEntitlementBody(rawBody);
    if (!this.tenants.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Platform store unavailable.', 503);
    }
    const tenant = await this.tenants.setEntitlement(
      actorUserId,
      tenantId,
      code,
      parsed.enabled,
      parsed.limit,
      parsed.reason,
      correlationId,
    );
    if (tenant === null) {
      throw AppError.notFound('School not found.');
    }
    return { data: tenant };
  }

  async updateTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    assertActor(actorUserId);
    if (!isUuid(tenantId)) {
      throw AppError.notFound('School not found.');
    }
    const parsed = parseUpdateTenantBody(rawBody);
    if (!this.tenants.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Platform store unavailable.', 503);
    }
    const tenant = await this.tenants.updateTenant(actorUserId, tenantId, parsed, correlationId);
    if (tenant === null) {
      throw AppError.notFound('School not found.');
    }
    return { data: tenant };
  }

  async listAudit(
    actorUserId: string,
    rawQuery: {
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly tenantId?: unknown;
      readonly action?: unknown;
    },
  ): Promise<ListPlatformAuditResult> {
    assertActor(actorUserId);
    const pagination = parsePaginationQuery(rawQuery);
    const tenantId = parseOptionalUuid(rawQuery.tenantId, 'tenantId');
    const action = parseOptionalAction(rawQuery.action);
    if (!this.tenants.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.tenants.listAudit(actorUserId, {
      limit: pagination.limit,
      cursor: pagination.cursor,
      tenantId,
      action,
    });
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  private async executeRegister(
    actorUserId: string,
    parsed: ReturnType<typeof parseRegisterBody>,
    correlationId: string,
  ): Promise<RegisterPlatformTenantResult> {
    try {
      const result = await this.tenants.registerTenant(
        actorUserId,
        {
          code: parsed.code,
          name: parsed.name,
          primaryLocale: parsed.primaryLocale,
          timezone: parsed.timezone,
          ownerEmail: parsed.owner.email,
          ownerDisplayName: parsed.owner.displayName,
        },
        correlationId,
      );
      return { data: result.tenant };
    } catch (error) {
      if (isPgCode(error, '23505')) {
        throw new AppError('CONFLICT', 'A school with this code already exists.');
      }
      throw error;
    }
  }

  private async changeStatus(
    actorUserId: string,
    tenantId: string,
    nextStatus: 'suspended' | 'active',
    rawBody: unknown,
    correlationId: string,
  ): Promise<GetPlatformTenantResult> {
    assertActor(actorUserId);
    if (!isUuid(tenantId)) {
      throw AppError.notFound('School not found.');
    }
    const reason = parseReason(rawBody);
    if (!this.tenants.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Platform store unavailable.', 503);
    }
    try {
      const tenant = await this.tenants.setTenantStatus(
        actorUserId,
        tenantId,
        nextStatus,
        reason,
        correlationId,
      );
      if (tenant === null) {
        throw AppError.notFound('School not found.');
      }
      return { data: tenant };
    } catch (error) {
      if (isCoded(error, 'INVALID_STATUS')) {
        const current = (error as { currentStatus?: string }).currentStatus ?? 'unknown';
        throw AppError.validation(`Cannot change status from ${current}.`, {
          currentStatus: current,
        });
      }
      throw error;
    }
  }
}

function assertActor(userId: string): void {
  if (!isUuid(userId)) {
    throw AppError.unauthorized();
  }
}

function parseRegisterBody(raw: unknown): {
  readonly code: string;
  readonly name: string;
  readonly primaryLocale: 'en' | 'sw';
  readonly timezone: string;
  readonly owner: { readonly email: string; readonly displayName: string };
} {
  if (typeof raw !== 'object' || raw === null) {
    throw AppError.validation('Request body is required.');
  }
  const body = raw as Record<string, unknown>;
  const code = asTrimmedString(body['code'], 'code');
  if (!CODE_PATTERN.test(code)) {
    throw AppError.validation('code must match ^[a-z0-9-]{3,64}$.', { field: 'code' });
  }
  const name = asTrimmedString(body['name'], 'name');
  if (name.length < 1 || name.length > 200) {
    throw AppError.validation('name must be 1–200 characters.', { field: 'name' });
  }
  const localeRaw = asTrimmedString(body['primaryLocale'], 'primaryLocale');
  if (!LOCALES.has(localeRaw)) {
    throw AppError.validation('primaryLocale must be en or sw.', { field: 'primaryLocale' });
  }
  const timezone = asTrimmedString(body['timezone'], 'timezone');
  if (timezone.length < 3 || timezone.length > 64) {
    throw AppError.validation('timezone is required.', { field: 'timezone' });
  }
  const ownerRaw = body['owner'];
  if (typeof ownerRaw !== 'object' || ownerRaw === null) {
    throw AppError.validation('owner is required.', { field: 'owner' });
  }
  const owner = ownerRaw as Record<string, unknown>;
  const email = asTrimmedString(owner['email'], 'owner.email').toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw AppError.validation('owner.email must be a valid email.', { field: 'owner.email' });
  }
  const displayName = asTrimmedString(owner['displayName'], 'owner.displayName');
  if (displayName.length < 1 || displayName.length > 200) {
    throw AppError.validation('owner.displayName must be 1–200 characters.', {
      field: 'owner.displayName',
    });
  }
  return {
    code,
    name,
    primaryLocale: localeRaw as 'en' | 'sw',
    timezone,
    owner: { email, displayName },
  };
}

function parsePlanBody(raw: unknown): { readonly planCode: string; readonly reason: string } {
  if (typeof raw !== 'object' || raw === null) {
    throw AppError.validation('Request body is required.');
  }
  const body = raw as Record<string, unknown>;
  const planCode = asTrimmedString(body['planCode'], 'planCode');
  if (!/^[a-z0-9-]{2,64}$/.test(planCode)) {
    throw AppError.validation('planCode is invalid.', { field: 'planCode' });
  }
  return { planCode, reason: parseReason(raw) };
}

function parseEntitlementBody(raw: unknown): {
  readonly enabled: boolean;
  readonly limit: number | null;
  readonly reason: string;
} {
  if (typeof raw !== 'object' || raw === null) {
    throw AppError.validation('Request body is required.');
  }
  const body = raw as Record<string, unknown>;
  if (typeof body['enabled'] !== 'boolean') {
    throw AppError.validation('enabled must be a boolean.', { field: 'enabled' });
  }
  let limit: number | null = null;
  if (body['limit'] !== undefined && body['limit'] !== null) {
    if (
      typeof body['limit'] !== 'number' ||
      !Number.isInteger(body['limit']) ||
      body['limit'] < 0
    ) {
      throw AppError.validation('limit must be an integer ≥ 0.', { field: 'limit' });
    }
    limit = body['limit'];
  }
  return { enabled: body['enabled'], limit, reason: parseReason(raw) };
}

function parseReason(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) {
    throw AppError.validation('Request body is required.');
  }
  const reason = asTrimmedString((raw as Record<string, unknown>)['reason'], 'reason');
  if (reason.length < 5 || reason.length > 500) {
    throw AppError.validation('reason must be 5–500 characters.', { field: 'reason' });
  }
  return reason;
}

function parseUpdateTenantBody(raw: unknown): {
  readonly name?: string;
  readonly primaryLocale?: 'en' | 'sw';
  readonly timezone?: string;
} {
  if (typeof raw !== 'object' || raw === null) {
    throw AppError.validation('Request body is required.');
  }
  const body = raw as Record<string, unknown>;
  const name = body['name'] !== undefined ? asTrimmedString(body['name'], 'name') : undefined;
  if (name !== undefined && (name.length < 2 || name.length > 200)) {
    throw AppError.validation('name must be between 2 and 200 characters.', { field: 'name' });
  }
  const localeRaw = body['primaryLocale'];
  let primaryLocale: 'en' | 'sw' | undefined = undefined;
  if (localeRaw !== undefined) {
    if (typeof localeRaw !== 'string' || !LOCALES.has(localeRaw)) {
      throw AppError.validation('primaryLocale must be en or sw.', { field: 'primaryLocale' });
    }
    primaryLocale = localeRaw as 'en' | 'sw';
  }
  const timezone =
    body['timezone'] !== undefined ? asTrimmedString(body['timezone'], 'timezone') : undefined;
  if (timezone !== undefined && (timezone.length < 2 || timezone.length > 80)) {
    throw AppError.validation('timezone is invalid.', { field: 'timezone' });
  }
  if (name === undefined && primaryLocale === undefined && timezone === undefined) {
    throw AppError.validation(
      'At least one field (name, primaryLocale, timezone) must be provided.',
    );
  }
  return {
    ...(name !== undefined ? { name } : {}),
    ...(primaryLocale !== undefined ? { primaryLocale } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
  };
}

function asTrimmedString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw AppError.validation(`${field} is required.`, { field });
  }
  return value.trim();
}

function parseOptionalEnum(
  raw: unknown,
  allowed: ReadonlySet<string>,
  field: string,
): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !allowed.has(raw)) {
    throw AppError.validation(`${field} is invalid.`, { field });
  }
  return raw;
}

function parseOptionalUuid(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw AppError.validation(`${field} must be a UUID.`, { field });
  }
  return raw;
}

function parseOptionalAction(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw !== 'string' || raw.trim().length < 3 || raw.trim().length > 80) {
    throw AppError.validation('action is invalid.', { field: 'action' });
  }
  return raw.trim();
}

function isEntitlementCode(value: string): value is EntitlementCode {
  return (ENTITLEMENT_CODES as readonly string[]).includes(value);
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function isCoded(error: unknown, code: string): boolean {
  return isPgCode(error, code);
}
