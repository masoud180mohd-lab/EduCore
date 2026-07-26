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
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import { RolesRepository, type RoleRow } from '../repositories/roles.repository.js';

export type RoleResult = { readonly data: RoleRow };
export type ListRolesResult = PaginatedResponse<RoleRow>;

const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_.]*$/;
const CREATE_ROUTE = '/api/v1/roles';

@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RolesRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

  async listForTenant(
    actorUserId: string,
    tenantId: string,
    rawQuery: { readonly limit?: unknown; readonly cursor?: unknown },
  ): Promise<ListRolesResult> {
    this.assertContext(actorUserId, tenantId);
    const pagination = parsePaginationQuery(rawQuery);
    if (!this.roles.isAvailable()) {
      return buildPaginatedResponse([], pagination.limit, null);
    }
    const page = await this.roles.listForTenant(actorUserId, tenantId, pagination);
    return buildPaginatedResponse(page.rows, pagination.limit, page.nextCursor);
  }

  async getForTenant(actorUserId: string, tenantId: string, roleId: string): Promise<RoleResult> {
    this.assertContext(actorUserId, tenantId);
    this.assertRoleId(roleId);
    if (!this.roles.isAvailable()) {
      throw AppError.notFound('Role not found.');
    }
    const role = await this.roles.getByIdForTenant(actorUserId, tenantId, roleId);
    if (role === null) {
      throw AppError.notFound('Role not found.');
    }
    return { data: role };
  }

  async createForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<RoleResult> {
    this.assertContext(actorUserId, tenantId);
    const key = assertIdempotencyKey(idempotencyKeyHeader);
    const parsed = parseCreateRoleRequest(rawBody);
    const bodyJson = JSON.stringify(parsed);
    return this.runIdempotent(actorUserId, tenantId, 'POST', CREATE_ROUTE, key, bodyJson, 201, () =>
      this.executeCreate(actorUserId, tenantId, parsed, correlationId),
    );
  }

  async renameForTenant(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<RoleResult> {
    this.assertContext(actorUserId, tenantId);
    this.assertRoleId(roleId);
    const parsed = parseRenameRoleRequest(rawBody);
    const key = parseIdempotencyKey(idempotencyKeyHeader);
    const execute = () =>
      this.executeRename(actorUserId, tenantId, roleId, parsed.name, correlationId);
    if (key === undefined) {
      return execute();
    }
    return this.runIdempotent(
      actorUserId,
      tenantId,
      'PATCH',
      `${CREATE_ROUTE}/${roleId}`,
      assertIdempotencyKey(key),
      JSON.stringify(parsed),
      200,
      execute,
    );
  }

  async replacePermissionsForTenant(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<RoleResult> {
    this.assertContext(actorUserId, tenantId);
    this.assertRoleId(roleId);
    const parsed = parseReplaceRolePermissionsRequest(rawBody);
    const key = parseIdempotencyKey(idempotencyKeyHeader);
    const execute = () =>
      this.executeReplacePermissions(
        actorUserId,
        tenantId,
        roleId,
        parsed.permissionCodes,
        correlationId,
      );
    if (key === undefined) {
      return execute();
    }
    return this.runIdempotent(
      actorUserId,
      tenantId,
      'PUT',
      `${CREATE_ROUTE}/${roleId}/permissions`,
      assertIdempotencyKey(key),
      JSON.stringify(parsed),
      200,
      execute,
    );
  }

  private async executeCreate(
    actorUserId: string,
    tenantId: string,
    input: { code: string; name: string; permissionCodes: ReadonlyArray<string> },
    correlationId: string,
  ): Promise<RoleResult> {
    if (!this.roles.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Role store unavailable.');
    }
    try {
      const role = await this.roles.createForTenant(actorUserId, tenantId, {
        roleId: randomUUID(),
        ...input,
      });
      if (role === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to create role.');
      }
      await this.publishAudit('role.create', actorUserId, tenantId, role.id, correlationId, {
        code: role.code,
        permissionCodes: [...input.permissionCodes],
      });
      return { data: role };
    } catch (error: unknown) {
      this.mapWriteError(
        error,
        'Role code already exists in this tenant.',
        'Failed to create role.',
      );
    }
  }

  private async executeRename(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    name: string,
    correlationId: string,
  ): Promise<RoleResult> {
    if (!this.roles.isAvailable()) {
      throw AppError.notFound('Role not found.');
    }
    try {
      const role = await this.roles.renameForTenant(actorUserId, tenantId, roleId, name);
      if (role === null) {
        throw AppError.notFound('Role not found.');
      }
      await this.publishAudit('role.patch', actorUserId, tenantId, roleId, correlationId, {
        fields: ['name'],
      });
      return { data: role };
    } catch (error: unknown) {
      this.mapWriteError(error, 'Role already exists.', 'Failed to rename role.');
    }
  }

  private async executeReplacePermissions(
    actorUserId: string,
    tenantId: string,
    roleId: string,
    permissionCodes: ReadonlyArray<string>,
    correlationId: string,
  ): Promise<RoleResult> {
    if (!this.roles.isAvailable()) {
      throw AppError.notFound('Role not found.');
    }
    try {
      const role = await this.roles.replacePermissionsForTenant(
        actorUserId,
        tenantId,
        roleId,
        permissionCodes,
      );
      if (role === null) {
        throw AppError.notFound('Role not found.');
      }
      await this.publishAudit(
        'role.permissions.replace',
        actorUserId,
        tenantId,
        roleId,
        correlationId,
        { permissionCodes: [...permissionCodes] },
      );
      return { data: role };
    } catch (error: unknown) {
      if (isPgInsufficientPrivilege(error)) {
        throw AppError.forbidden('System role permissions cannot be edited.');
      }
      this.mapWriteError(
        error,
        'Role permission assignment conflicts.',
        'Failed to replace role permissions.',
      );
    }
  }

  private async runIdempotent(
    actorUserId: string,
    tenantId: string,
    method: string,
    route: string,
    key: string,
    bodyJson: string,
    statusCode: number,
    execute: () => Promise<RoleResult>,
  ): Promise<RoleResult> {
    if (this.idempotency === null) {
      return execute();
    }
    const scopeKey = buildIdempotencyScopeKey({ actorUserId, tenantId, method, route }, key);
    const bodyHash = hashRequestBody(bodyJson);
    const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
    if (replay !== null) {
      return JSON.parse(replay.responseBody) as RoleResult;
    }
    const result = await execute();
    await this.idempotency.put(scopeKey, {
      bodyHash,
      statusCode,
      responseBody: JSON.stringify(result),
      createdAt: new Date().toISOString(),
    });
    return result;
  }

  private async publishAudit(
    action: string,
    actorUserId: string,
    tenantId: string,
    roleId: string,
    correlationId: string,
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.audit?.publish({
      action,
      outcome: 'success',
      correlationId,
      actorUserId,
      tenantId,
      resourceType: 'role',
      resourceId: roleId,
      metadata,
    });
  }

  private assertContext(actorUserId: string, tenantId: string): void {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }
  }

  private assertRoleId(roleId: string): void {
    if (!isUuid(roleId)) {
      throw AppError.notFound('Role not found.');
    }
  }

  private mapWriteError(error: unknown, conflictMessage: string, fallbackMessage: string): never {
    if (error instanceof AppError) {
      throw error;
    }
    if (isPgUniqueViolation(error)) {
      throw new AppError('CONFLICT', conflictMessage);
    }
    if (isPgInvalidParameter(error)) {
      throw AppError.validation('Invalid role or permission data.');
    }
    throw new AppError('INTERNAL_ERROR', fallbackMessage);
  }
}

export function parseCreateRoleRequest(raw: unknown): {
  code: string;
  name: string;
  permissionCodes: ReadonlyArray<string>;
} {
  const body = parseObject(raw, new Set(['code', 'name', 'permissionCodes']));
  if (typeof body['code'] !== 'string' || !ROLE_CODE_PATTERN.test(body['code'])) {
    throw AppError.validation('code must match ^[a-z][a-z0-9_]{1,63}$.', { field: 'code' });
  }
  return {
    code: body['code'],
    name: parseName(body['name']),
    permissionCodes: parsePermissionCodes(body['permissionCodes'], false),
  };
}

export function parseRenameRoleRequest(raw: unknown): { name: string } {
  const body = parseObject(raw, new Set(['name']));
  return { name: parseName(body['name']) };
}

export function parseReplaceRolePermissionsRequest(raw: unknown): {
  permissionCodes: ReadonlyArray<string>;
} {
  const body = parseObject(raw, new Set(['permissionCodes']));
  return { permissionCodes: parsePermissionCodes(body['permissionCodes'], true) };
}

function parseObject(raw: unknown, allowed: ReadonlySet<string>): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }
  return body;
}

function parseName(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw AppError.validation('name is required.', { field: 'name' });
  }
  const name = raw.trim();
  if (name.length < 1 || name.length > 120) {
    throw AppError.validation('name must be 1–120 characters.', { field: 'name' });
  }
  return name;
}

function parsePermissionCodes(raw: unknown, required: boolean): ReadonlyArray<string> {
  if (raw === undefined && !required) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw AppError.validation('permissionCodes must be an array of strings.', {
      field: 'permissionCodes',
    });
  }
  const seen = new Set<string>();
  return raw.map((value, index) => {
    if (typeof value !== 'string' || !PERMISSION_CODE_PATTERN.test(value)) {
      throw AppError.validation(`permissionCodes[${String(index)}] is invalid.`, {
        field: 'permissionCodes',
      });
    }
    if (seen.has(value)) {
      throw AppError.validation('permissionCodes must not contain duplicates.', {
        field: 'permissionCodes',
      });
    }
    seen.add(value);
    return value;
  });
}

function isPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function isPgUniqueViolation(error: unknown): boolean {
  return isPgCode(error, '23505');
}

function isPgInvalidParameter(error: unknown): boolean {
  return isPgCode(error, '22023');
}

function isPgInsufficientPrivilege(error: unknown): boolean {
  return isPgCode(error, '42501');
}
