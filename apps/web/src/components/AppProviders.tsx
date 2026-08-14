'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  MESSAGES,
  formatMessage,
  resolveUiLocale,
  type MessageKey,
  type UiLocale,
} from '@/lib/i18n/messages';
import { readStoredLocale, writeStoredLocale } from '@/lib/i18n/storage';
import {
  applyThemeToDocument,
  readStoredTheme,
  writeStoredTheme,
  type UiTheme,
} from '@/lib/theme/storage';

type AppPreferencesContextValue = {
  readonly locale: UiLocale;
  readonly theme: UiTheme;
  readonly setLocale: (locale: UiLocale) => void;
  readonly setTheme: (theme: UiTheme) => void;
  readonly t: (key: MessageKey, vars?: Readonly<Record<string, string | number>>) => string;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function initialTheme(): UiTheme {
  const stored = readStoredTheme();
  if (stored !== null) return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function AppProviders({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(() => readStoredLocale() ?? 'en');
  const [theme, setThemeState] = useState<UiTheme>(() => initialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    document.documentElement.lang = locale;
  }, [locale, theme]);

  const setLocale = useCallback((next: UiLocale) => {
    writeStoredLocale(next);
    setLocaleState(next);
  }, []);

  const setTheme = useCallback((next: UiTheme) => {
    writeStoredTheme(next);
    setThemeState(next);
    applyThemeToDocument(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Readonly<Record<string, string | number>>) =>
      formatMessage(MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, theme, setLocale, setTheme, t }),
    [locale, theme, setLocale, setTheme, t],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (ctx === null) {
    throw new Error('useAppPreferences must be used within AppProviders');
  }
  return ctx;
}

/** Seed locale from tenant primaryLocale once per session. */
export function useTenantLocaleHint(primaryLocale: string | null | undefined): void {
  const { setLocale } = useAppPreferences();
  useEffect(() => {
    if (readStoredLocale() !== null) return;
    setLocale(resolveUiLocale(primaryLocale));
  }, [primaryLocale, setLocale]);
}
