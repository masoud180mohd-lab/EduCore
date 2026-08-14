'use client';

import { useAppPreferences } from '@/components/AppProviders';
import type { UiLocale } from '@/lib/i18n/messages';
import type { UiTheme } from '@/lib/theme/storage';

export function AdminChromeControls() {
  const { locale, theme, setLocale, setTheme, t } = useAppPreferences();

  return (
    <div className="admin-console-actions">
      <label className="admin-console-pref">
        <span className="admin-console-pref-label">{t('shell.language')}</span>
        <select
          className="admin-console-select"
          value={locale}
          aria-label={t('shell.language')}
          onChange={(event) => setLocale(event.target.value as UiLocale)}
        >
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
        </select>
      </label>
      <div className="admin-console-pref admin-console-theme" role="group" aria-label="Theme">
        <button
          type="button"
          className={theme === 'light' ? 'admin-console-chip is-active' : 'admin-console-chip'}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light' as UiTheme)}
        >
          {t('shell.themeLight')}
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'admin-console-chip is-active' : 'admin-console-chip'}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark' as UiTheme)}
        >
          {t('shell.themeDark')}
        </button>
      </div>
    </div>
  );
}
