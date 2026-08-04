/**
 * Lab prompt catalog (AI-003) — mirrors seeded ai_prompt_templates.
 * HTTP create/update of prompts is out of scope; publish via migration helper.
 */

export type AiLabPromptCatalogEntry = {
  readonly code: string;
  readonly locales: ReadonlyArray<'en' | 'sw'>;
  readonly allowlistPlaceholders: ReadonlyArray<string>;
  readonly description: string;
};

export const AI_LAB_PROMPT_CATALOG: ReadonlyArray<AiLabPromptCatalogEntry> = [
  {
    code: 'lab.echo',
    locales: ['en', 'sw'],
    allowlistPlaceholders: ['message'],
    description: 'Deterministic echo lab prompt for Fake AI gateway smoke path',
  },
] as const;

export function isKnownLabPromptCode(code: string): boolean {
  return AI_LAB_PROMPT_CATALOG.some((entry) => entry.code === code);
}
