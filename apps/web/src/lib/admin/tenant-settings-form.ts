export const TENANT_SETTINGS_KNOWN_KEYS = ['timezone', 'locale', 'currency'] as const;

export type TenantSettingsKnownKey = (typeof TENANT_SETTINGS_KNOWN_KEYS)[number];

export type KnownTenantSettings = {
  readonly timezone: string;
  readonly locale: string;
  readonly currency: string;
};

export function splitKnownSettings(settings: Readonly<Record<string, unknown>>): {
  readonly known: KnownTenantSettings;
  readonly extras: Record<string, unknown>;
} {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!(TENANT_SETTINGS_KNOWN_KEYS as readonly string[]).includes(key)) {
      extras[key] = value;
    }
  }
  return {
    known: {
      timezone: typeof settings['timezone'] === 'string' ? settings['timezone'] : '',
      locale: typeof settings['locale'] === 'string' ? settings['locale'] : '',
      currency: typeof settings['currency'] === 'string' ? settings['currency'] : '',
    },
    extras,
  };
}

/** Merge server extras with operator-known fields for PUT (IMP-032 preserve-merge). */
export function mergeSettingsForSave(
  extras: Readonly<Record<string, unknown>>,
  known: KnownTenantSettings,
): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...extras };
  if (known.timezone.trim() !== '') settings['timezone'] = known.timezone.trim();
  else delete settings['timezone'];
  if (known.locale.trim() !== '') settings['locale'] = known.locale.trim();
  else delete settings['locale'];
  if (known.currency.trim() !== '') settings['currency'] = known.currency.trim();
  else delete settings['currency'];
  return settings;
}

export function extrasToJson(extras: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(extras, null, 2);
}

export type ValidateExtrasJsonResult =
  | { readonly ok: true; readonly extras: Record<string, unknown> }
  | { readonly ok: false; readonly message: string };

export function validateExtrasJson(json: string): ValidateExtrasJsonResult {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'Additional settings must be a JSON object.' };
    }
    return { ok: true, extras: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: 'Additional settings JSON is invalid.' };
  }
}

/** Compare extras JSON for Advanced save confirm (normalized object equality). */
export function extrasJsonChanged(currentJson: string, baselineJson: string): boolean {
  const current = validateExtrasJson(currentJson);
  const baseline = validateExtrasJson(baselineJson);
  if (!current.ok || !baseline.ok) {
    return currentJson.trim() !== baselineJson.trim();
  }
  return JSON.stringify(current.extras) !== JSON.stringify(baseline.extras);
}
