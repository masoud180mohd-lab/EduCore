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
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { AUDIT_PUBLISHER, type AuditPublisher } from '../../platform-operations/index.js';
import {
  TenantSettingsRepository,
  type TenantSettingsRow,
} from '../repositories/tenant-settings.repository.js';

/** Public settings document (ACF TenantSettingsEnvelope data shape). */
export type TenantSettingsDocument = TenantSettingsRow;

export type GetTenantSettingsResult = {
  readonly data: TenantSettingsDocument;
};

export type PutTenantSettingsResult = {
  readonly data: TenantSettingsDocument;
};

const PUT_ROUTE = '/api/v1/tenant-settings';
const ALLOWED_WRITE_KEYS = new Set(['schemaVersion', 'settings']);

/**
 * Product API for the bound tenant settings document.
 * GET: read-only. PUT (P14): replace/upsert with tenant.manage (controller AuthZ).
 */
@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly tenantSettings: TenantSettingsRepository,
    @Optional()
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotency: IdempotencyStore | null = null,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
  ) {}

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

  /**
   * PUT /tenant-settings — replace (UPSERT) settings document.
   * Optional Idempotency-Key: when present, replay or conflict via platform helpers.
   */
  async putForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
    correlationId: string,
  ): Promise<PutTenantSettingsResult> {
    if (!isUuid(actorUserId)) {
      throw AppError.unauthorized();
    }
    if (!isUuid(tenantId)) {
      throw AppError.tenantContextRequired();
    }

    const parsed = parseTenantSettingsWrite(rawBody);
    const bodyJson = JSON.stringify({
      schemaVersion: parsed.schemaVersion,
      settings: parsed.settings,
    });

    const optionalKey = parseIdempotencyKey(idempotencyKeyHeader);
    if (optionalKey !== undefined) {
      const key = assertIdempotencyKey(optionalKey);
      if (this.idempotency !== null) {
        const scopeKey = buildIdempotencyScopeKey(
          {
            actorUserId,
            tenantId,
            method: 'PUT',
            route: PUT_ROUTE,
          },
          key,
        );
        const bodyHash = hashRequestBody(bodyJson);
        const replay = await resolveIdempotentReplay(this.idempotency, scopeKey, bodyHash);
        if (replay !== null) {
          return JSON.parse(replay.responseBody) as PutTenantSettingsResult;
        }

        const result = await this.executePut(actorUserId, tenantId, parsed, correlationId);
        await this.idempotency.put(scopeKey, {
          bodyHash,
          statusCode: 200,
          responseBody: JSON.stringify(result),
          createdAt: new Date().toISOString(),
        });
        return result;
      }
    }

    return this.executePut(actorUserId, tenantId, parsed, correlationId);
  }

  private async executePut(
    actorUserId: string,
    tenantId: string,
    parsed: { schemaVersion: number; settings: Readonly<Record<string, unknown>> },
    correlationId: string,
  ): Promise<PutTenantSettingsResult> {
    if (!this.tenantSettings.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Settings store unavailable.');
    }

    try {
      const saved = await this.tenantSettings.replaceForTenant(
        actorUserId,
        tenantId,
        parsed.schemaVersion,
        parsed.settings,
      );
      if (saved === null) {
        throw new AppError('INTERNAL_ERROR', 'Failed to save tenant settings.');
      }

      if (this.audit !== null) {
        await this.audit.publish({
          action: 'tenant_settings.put',
          outcome: 'success',
          correlationId,
          actorUserId,
          tenantId,
          resourceType: 'tenant_settings',
          resourceId: tenantId,
          metadata: { schemaVersion: parsed.schemaVersion },
        });
      }

      return { data: saved };
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to save tenant settings.');
    }
  }
}

/**
 * Boundary validation for TenantSettingsWrite.
 * - Required: schemaVersion (integer >= 1), settings (object, not array/null)
 * - Unknown top-level keys → VALIDATION_ERROR
 * - Nested settings keys: free-form object for schemaVersion 1 (OpenAPI additionalProperties)
 */
export function parseTenantSettingsWrite(raw: unknown): {
  schemaVersion: number;
  settings: Readonly<Record<string, unknown>>;
} {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_WRITE_KEYS.has(key)) {
      throw AppError.validation(`Unknown field: ${key}.`, { field: key });
    }
  }

  if (!('schemaVersion' in body)) {
    throw AppError.validation('schemaVersion is required.', { field: 'schemaVersion' });
  }
  if (!('settings' in body)) {
    throw AppError.validation('settings is required.', { field: 'settings' });
  }

  const schemaVersion = body['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw AppError.validation('schemaVersion must be an integer >= 1.', {
      field: 'schemaVersion',
    });
  }

  const settings = body['settings'];
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) {
    throw AppError.validation('settings must be a JSON object.', { field: 'settings' });
  }

  return {
    schemaVersion,
    settings: settings as Readonly<Record<string, unknown>>,
  };
}
