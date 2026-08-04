/**
 * AI Gateway application service — single invoke entry (ADR-003 / AI-002).
 */
import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  aiDailyCapFromEnv,
  assertAiVariableAllowlist,
  isAiFeatureEnvDisabled,
  isAiPlatformEnabled,
  isRuntimeAiFeatureAllowed,
  redactForAi,
  renderAiPromptBody,
  resolveAiProviderName,
} from './ai-feature-gate.js';
import type {
  AiGatewayPort,
  AiInvokeCommand,
  AiInvokeResult,
  AiProviderPort,
} from '../providers/ai-gateway.port.js';
import { AI_PROVIDER_PORT } from '../providers/ai-gateway.port.js';
import { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';

const OUTPUT_PREVIEW_MAX = 240;

@Injectable()
export class AiGatewayService implements AiGatewayPort {
  constructor(
    private readonly repo: AiGatewayRepository,
    @Inject(AI_PROVIDER_PORT) private readonly provider: AiProviderPort,
  ) {}

  async invoke(command: AiInvokeCommand): Promise<AiInvokeResult> {
    const requestId = randomUUID();
    const featureCode = command.featureCode.trim();
    const promptCode = command.promptCode.trim();
    const locale = command.locale.trim().toLowerCase();
    const correlationId =
      command.correlationId.trim() === '' ? requestId : command.correlationId.trim();

    if (!isAiPlatformEnabled() || resolveAiProviderName() === 'disabled') {
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: 0,
        locale,
        correlationId,
        status: 'disabled',
        rejectReason: 'platform_disabled',
        modelCode: null,
        providerCode: 'disabled',
        usage: null,
        outputText: null,
        variablesRedacted: null,
        countUsage: false,
      });
    }

    if (!isRuntimeAiFeatureAllowed(featureCode) || isAiFeatureEnvDisabled(featureCode)) {
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: 0,
        locale,
        correlationId,
        status: 'rejected',
        rejectReason: 'feature_blocked',
        modelCode: null,
        providerCode: this.provider.providerCode,
        usage: null,
        outputText: null,
        variablesRedacted: null,
        countUsage: false,
      });
    }

    if (!this.repo.isAvailable()) {
      return {
        requestId,
        status: 'failed',
        outputText: null,
        modelCode: null,
        usage: null,
        rejectReason: 'store_unavailable',
        providerCode: this.provider.providerCode,
      };
    }

    const prompt = await this.repo.getActivePrompt(
      command.actorUserId,
      command.tenantId,
      promptCode,
      locale,
    );
    if (prompt === null) {
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: 0,
        locale,
        correlationId,
        status: 'rejected',
        rejectReason: 'prompt_not_found',
        modelCode: null,
        providerCode: this.provider.providerCode,
        usage: null,
        outputText: null,
        variablesRedacted: null,
        countUsage: false,
      });
    }

    try {
      assertAiVariableAllowlist(prompt.allowlistPlaceholders, command.variables);
    } catch {
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: prompt.version,
        locale,
        correlationId,
        status: 'rejected',
        rejectReason: 'unknown_variable',
        modelCode: null,
        providerCode: this.provider.providerCode,
        usage: null,
        outputText: null,
        variablesRedacted: null,
        countUsage: false,
      });
    }

    const variablesRedacted = redactForAi(command.variables);
    const renderedPrompt = renderAiPromptBody(prompt.body, variablesRedacted);

    const dailyCap = aiDailyCapFromEnv();
    if (dailyCap >= 0) {
      let used: number;
      try {
        used = await this.repo.sumRequestCountForDate(
          command.actorUserId,
          command.tenantId,
          utcTodayDateString(),
        );
      } catch {
        return this.settle({
          command,
          requestId,
          featureCode,
          promptCode,
          promptVersion: prompt.version,
          locale,
          correlationId,
          status: 'failed',
          rejectReason: 'meter_unavailable',
          modelCode: null,
          providerCode: this.provider.providerCode,
          usage: null,
          outputText: null,
          variablesRedacted,
          countUsage: false,
        });
      }
      if (used >= dailyCap) {
        return this.settle({
          command,
          requestId,
          featureCode,
          promptCode,
          promptVersion: prompt.version,
          locale,
          correlationId,
          status: 'rejected',
          rejectReason: 'daily_cap',
          modelCode: null,
          providerCode: this.provider.providerCode,
          usage: null,
          outputText: null,
          variablesRedacted,
          countUsage: false,
        });
      }
    }

    try {
      const generated = await this.provider.generate({
        renderedPrompt,
        featureCode,
        correlationId,
      });
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: prompt.version,
        locale,
        correlationId,
        status: 'succeeded',
        rejectReason: null,
        modelCode: generated.modelCode,
        providerCode: generated.providerCode,
        usage: {
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          estimatedCostMinor: generated.estimatedCostMinor,
        },
        outputText: generated.outputText,
        variablesRedacted,
        countUsage: true,
      });
    } catch {
      return this.settle({
        command,
        requestId,
        featureCode,
        promptCode,
        promptVersion: prompt.version,
        locale,
        correlationId,
        status: 'failed',
        rejectReason: 'provider_error',
        modelCode: null,
        providerCode: this.provider.providerCode,
        usage: null,
        outputText: null,
        variablesRedacted,
        countUsage: false,
      });
    }
  }

  private async settle(input: {
    readonly command: AiInvokeCommand;
    readonly requestId: string;
    readonly featureCode: string;
    readonly promptCode: string;
    readonly promptVersion: number;
    readonly locale: string;
    readonly correlationId: string;
    readonly status: 'succeeded' | 'failed' | 'rejected' | 'disabled';
    readonly rejectReason: string | null;
    readonly modelCode: string | null;
    readonly providerCode: string | null;
    readonly usage: AiInvokeResult['usage'];
    readonly outputText: string | null;
    readonly variablesRedacted: Readonly<Record<string, string>> | null;
    readonly countUsage: boolean;
  }): Promise<AiInvokeResult> {
    const preview =
      input.outputText === null
        ? null
        : input.outputText.length > OUTPUT_PREVIEW_MAX
          ? `${input.outputText.slice(0, OUTPUT_PREVIEW_MAX)}…`
          : input.outputText;

    if (this.repo.isAvailable()) {
      try {
        await this.repo.completeInvoke({
          actorUserId: input.command.actorUserId,
          tenantId: input.command.tenantId,
          requestId: input.requestId,
          featureCode: input.featureCode,
          promptCode: input.promptCode,
          promptVersion: input.promptVersion,
          locale: input.locale,
          correlationId: input.correlationId,
          status: input.status,
          rejectReason: input.rejectReason,
          modelCode: input.modelCode,
          providerCode: input.providerCode,
          inputTokens: input.usage?.inputTokens ?? null,
          outputTokens: input.usage?.outputTokens ?? null,
          estimatedCostMinor: input.usage?.estimatedCostMinor ?? null,
          outputPreview: preview,
          variablesRedacted: input.variablesRedacted,
          countUsage: input.countUsage,
        });
      } catch {
        return {
          requestId: input.requestId,
          status: 'failed',
          outputText: null,
          modelCode: null,
          usage: null,
          rejectReason: 'persist_failed',
          providerCode: input.providerCode,
        };
      }
    }

    return {
      requestId: input.requestId,
      status: input.status,
      outputText: input.outputText,
      modelCode: input.modelCode,
      usage: input.usage,
      rejectReason: input.rejectReason,
      providerCode: input.providerCode,
    };
  }
}

export function utcTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Unit-test helper without Nest DI. */
export function createAiGatewayServiceForTest(
  repo: AiGatewayRepository,
  provider: AiProviderPort,
): AiGatewayService {
  return new AiGatewayService(repo, provider);
}
