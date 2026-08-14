import type { UiLocale } from '@/lib/i18n/messages';

export const UI_LOCALE_STORAGE_KEY = 'educore-ui-locale';

export function readStoredLocale(): UiLocale | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (raw === 'en' || raw === 'sw') return raw;
  return null;
}

export function writeStoredLocale(locale: UiLocale): void {
  window.sessionStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
}
