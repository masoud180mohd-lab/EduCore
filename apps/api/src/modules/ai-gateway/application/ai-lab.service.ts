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
import { AI_LAB_PROMPT_CATALOG } from './ai-prompt-catalog.js';
import { AiGatewayService } from './ai-gateway.service.js';
import { parseAiUsageDate, sumAiUsageRows } from './ai-usage.js';
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
    rawQuery: {
      readonly code?: unknown;
      readonly locale?: unknown;
      readonly includeRetired?: unknown;
    } = {},
  ): Promise<{
    readonly data: ReadonlyArray<AiPromptTemplateRow>;
    readonly meta: {
      readonly catalog: ReadonlyArray<{
        readonly code: string;
        readonly locales: ReadonlyArray<string>;
        readonly allowlistPlaceholders: ReadonlyArray<string>;
        readonly description: string;
      }>;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const filters = parsePromptListQuery(rawQuery);
    const catalog = AI_LAB_PROMPT_CATALOG.map((entry) => ({
      code: entry.code,
      locales: [...entry.locales],
      allowlistPlaceholders: [...entry.allowlistPlaceholders],
      description: entry.description,
    }));
    if (!this.repo.isAvailable()) return { data: [], meta: { catalog } };
    return {
      data: await this.repo.listPrompts(actorUserId, tenantId, filters),
      meta: { catalog },
    };
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
      readonly inputTokensTotal: number;
      readonly outputTokensTotal: number;
      readonly estimatedCostMinorTotal: number;
      readonly dailyCap: number | null;
      readonly bypassDailyCap: boolean;
      readonly platformEnabled: boolean;
    };
  }> {
    if (!isUuid(actorUserId)) throw AppError.unauthorized();
    if (!isUuid(tenantId)) throw AppError.tenantContextRequired();
    const usageDate = parseAiUsageDate(dateQuery);
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
          inputTokensTotal: 0,
          outputTokensTotal: 0,
          estimatedCostMinorTotal: 0,
          dailyCap: bypassDailyCap ? null : cap,
          bypassDailyCap,
          platformEnabled,
        },
      };
    }
    const rows = await this.repo.listUsageDaily(actorUserId, tenantId, usageDate, featureCode);
    const totals = sumAiUsageRows(rows);
    return {
      data: {
        usageDate,
        rows,
        ...totals,
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
    if (result.status === 'failed' && result.rejectReason === 'meter_unavailable') {
      throw new AppError('INTERNAL_ERROR', 'AI usage meter unavailable.');
    }

    return { data: result };
  }
}

function parsePromptListQuery(raw: {
  readonly code?: unknown;
  readonly locale?: unknown;
  readonly includeRetired?: unknown;
}): {
  readonly code?: string;
  readonly locale?: string;
  readonly includeRetired?: boolean;
} {
  let code: string | undefined;
  if (raw.code !== undefined && raw.code !== null && raw.code !== '') {
    if (typeof raw.code !== 'string' || raw.code.trim() === '') {
      throw AppError.validation('code must be a non-empty string.', { field: 'code' });
    }
    code = raw.code.trim();
  }

  let locale: string | undefined;
  if (raw.locale !== undefined && raw.locale !== null && raw.locale !== '') {
    if (raw.locale !== 'en' && raw.locale !== 'sw') {
      throw AppError.validation('locale must be en or sw.', { field: 'locale' });
    }
    locale = raw.locale;
  }

  let includeRetired: boolean | undefined;
  if (
    raw.includeRetired !== undefined &&
    raw.includeRetired !== null &&
    raw.includeRetired !== ''
  ) {
    if (
      raw.includeRetired === true ||
      raw.includeRetired === 'true' ||
      raw.includeRetired === '1'
    ) {
      includeRetired = true;
    } else if (
      raw.includeRetired === false ||
      raw.includeRetired === 'false' ||
      raw.includeRetired === '0'
    ) {
      includeRetired = false;
    } else {
      throw AppError.validation('includeRetired must be true or false.', {
        field: 'includeRetired',
      });
    }
  }

  const out: {
    code?: string;
    locale?: string;
    includeRetired?: boolean;
  } = {};
  if (code !== undefined) out.code = code;
  if (locale !== undefined) out.locale = locale;
  if (includeRetired !== undefined) out.includeRetired = includeRetired;
  return out;
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
