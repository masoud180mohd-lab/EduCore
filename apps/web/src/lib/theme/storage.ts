export type UiTheme = 'light' | 'dark';

export const UI_THEME_STORAGE_KEY = 'educore-ui-theme';

export function readStoredTheme(): UiTheme | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(UI_THEME_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

export function writeStoredTheme(theme: UiTheme): void {
  window.sessionStorage.setItem(UI_THEME_STORAGE_KEY, theme);
}

export function applyThemeToDocument(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
