/**
 * Lab / admin HTTP surface for AI gateway (ACF-AI-001).
 */
import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  aiDailyCapFromEnv,
  isAiPlatformEnabled,
  isRuntimeAiFeatureAllowed,
} from './ai-feature-gate.js';
import { AiGatewayService } from './ai-gateway.service.js';
import type { AiInvokeResult } from '../providers/ai-gateway.port.js';
import { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';
import type {
  AiInvokeRequestRow,
  AiPromptTemplateRow,
  AiUsageDailyRow,
} from '../repositories/ai-gateway.repository.js';

@Injectable()
export class AiLabService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly repo: AiGatewayRepository,
  ) {}

  async listPromptsForTenant(
    actorUserId: string,
    tenantId: string,
  ): Promise<{ readonly data: ReadonlyArray<AiPromptTemplateRow> }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!this.repo.isAvailable()) return { data: [] };
    return { data: await this.repo.listActivePrompts(actorUserId, tenantId) };
  }

  async getUsageForTenant(
    actorUserId: string,
    tenantId: string,
    dateQuery: unknown,
    featureCodeQuery: unknown,
  ): Promise<{
    readonly data: {
      readonly usageDate: string;
      readonly rows: ReadonlyArray<AiUsageDailyRow>;
      readonly requestCountTotal: number;
      readonly dailyCap: number | null;
      readonly bypassDailyCap: boolean;
      readonly platformEnabled: boolean;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const usageDate = parseUsageDate(dateQuery);
    const featureCode = parseOptionalFeatureCode(featureCodeQuery);
    const cap = aiDailyCapFromEnv();
    const bypassDailyCap = cap < 0;
    const platformEnabled = isAiPlatformEnabled();
    if (!this.repo.isAvailable()) {
      return {
        data: {
          usageDate,
          rows: [],
          requestCountTotal: 0,
          dailyCap: bypassDailyCap ? null : cap,
          bypassDailyCap,
          platformEnabled,
        },
      };
    }
    const rows = await this.repo.listUsageDaily(actorUserId, tenantId, usageDate, featureCode);
    const requestCountTotal = rows.reduce((sum, row) => sum + row.requestCount, 0);
    return {
      data: {
        usageDate,
        rows,
        requestCountTotal,
        dailyCap: bypassDailyCap ? null : cap,
        bypassDailyCap,
        platformEnabled,
      },
    };
  }

  async getInvokeForTenant(
    actorUserId: string,
    tenantId: string,
    requestId: string,
  ): Promise<{ readonly data: AiInvokeRequestRow }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    if (!isUuid(requestId)) throw AppError.notFound('AI invoke request not found.');
    if (!this.repo.isAvailable()) throw AppError.notFound('AI invoke request not found.');
    const row = await this.repo.getInvokeRequest(actorUserId, tenantId, requestId);
    if (row === null) throw AppError.notFound('AI invoke request not found.');
    return { data: row };
  }

  async labInvokeForTenant(
    actorUserId: string,
    tenantId: string,
    rawBody: unknown,
    correlationId: string,
  ): Promise<{ readonly data: AiInvokeResult }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const parsed = parseLabInvokeBody(rawBody);
    if (!isRuntimeAiFeatureAllowed(parsed.featureCode)) {
      throw AppError.validation('featureCode is not allowlisted for lab invoke.', {
        field: 'featureCode',
      });
    }

    const result = await this.gateway.invoke({
      tenantId,
      actorUserId,
      featureCode: parsed.featureCode,
      promptCode: parsed.promptCode,
      locale: parsed.locale,
      variables: parsed.variables,
      correlationId: parsed.correlationId ?? correlationId,
    });

    if (result.status === 'rejected' && result.rejectReason === 'daily_cap') {
      throw new AppError('CONFLICT', 'AI daily cap exceeded for this tenant.', 409, {
        rejectReason: 'daily_cap',
        requestId: result.requestId,
      });
    }
    if (result.status === 'rejected' && result.rejectReason === 'unknown_variable') {
      throw AppError.validation('Unknown prompt placeholder in variables.', {
        field: 'variables',
        requestId: result.requestId,
      });
    }
    if (result.status === 'rejected' && result.rejectReason === 'prompt_not_found') {
      throw AppError.validation('Active prompt not found for code/locale.', {
        field: 'promptCode',
        requestId: result.requestId,
      });
    }
    if (result.status === 'failed' && result.rejectReason === 'store_unavailable') {
      throw new AppError('INTERNAL_ERROR', 'AI gateway store unavailable.');
    }

    return { data: result };
  }
}

function parseUsageDate(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return new Date().toISOString().slice(0, 10);
  if (typeof raw !== 'string') {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw AppError.validation('date must be YYYY-MM-DD.', { field: 'date' });
  }
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw AppError.validation('date must be a valid calendar day.', { field: 'date' });
  }
  return trimmed;
}

function parseOptionalFeatureCode(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw AppError.validation('featureCode must be a non-empty string.', { field: 'featureCode' });
  }
  return raw.trim();
}

type ParsedLabInvoke = {
  readonly featureCode: string;
  readonly promptCode: string;
  readonly locale: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly correlationId: string | undefined;
};

function parseLabInvokeBody(raw: unknown): ParsedLabInvoke {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(['featureCode', 'promptCode', 'locale', 'variables', 'correlationId']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) throw AppError.validation(`Unknown field: ${key}.`, { field: key });
  }

  if (typeof body['featureCode'] !== 'string' || body['featureCode'].trim() === '') {
    throw AppError.validation('featureCode is required.', { field: 'featureCode' });
  }
  if (typeof body['promptCode'] !== 'string' || body['promptCode'].trim() === '') {
    throw AppError.validation('promptCode is required.', { field: 'promptCode' });
  }
  const locale = body['locale'] === undefined ? 'en' : body['locale'];
  if (locale !== 'en' && locale !== 'sw') {
    throw AppError.validation('locale must be en or sw.', { field: 'locale' });
  }
  if (
    body['variables'] === null ||
    typeof body['variables'] !== 'object' ||
    Array.isArray(body['variables'])
  ) {
    throw AppError.validation('variables must be an object.', { field: 'variables' });
  }
  const variablesRaw = body['variables'] as Record<string, unknown>;
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(variablesRaw)) {
    if (typeof v !== 'string') {
      throw AppError.validation(`variables.${k} must be a string.`, { field: `variables.${k}` });
    }
    variables[k] = v;
  }

  let correlationId: string | undefined;
  if (body['correlationId'] !== undefined && body['correlationId'] !== null) {
    if (typeof body['correlationId'] !== 'string' || body['correlationId'].trim() === '') {
      throw AppError.validation('correlationId must be a non-empty string.', {
        field: 'correlationId',
      });
    }
    correlationId = body['correlationId'].trim();
  }

  return {
    featureCode: body['featureCode'].trim(),
    promptCode: body['promptCode'].trim(),
    locale,
    variables,
    correlationId,
  };
}
