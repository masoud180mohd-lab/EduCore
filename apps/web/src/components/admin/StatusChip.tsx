'use client';

import { useAppPreferences } from '@/components/AppProviders';
import { translateToken } from '@/lib/i18n/messages';

/**
 * Status chip for registry / fees / academic rows (IMP-027).
 * Tone is optional; default uses neutral `.chip`. Label is translated when a catalog token exists.
 */
export function StatusChip({
  label,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly tone?: 'neutral' | 'ok' | 'muted';
}) {
  const { t } = useAppPreferences();
  const toneClass = tone === 'ok' ? ' chip-open' : tone === 'muted' ? ' chip-closed' : '';
  return <span className={`chip${toneClass}`}>{translateToken(t, label)}</span>;
}
