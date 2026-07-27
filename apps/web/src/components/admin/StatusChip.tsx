/**
 * Status chip for registry / fees / academic rows (IMP-027).
 * Tone is optional; default uses neutral `.chip`.
 */
export function StatusChip({
  label,
  tone = 'neutral',
}: {
  readonly label: string;
  readonly tone?: 'neutral' | 'ok' | 'muted';
}) {
  const toneClass = tone === 'ok' ? ' chip-open' : tone === 'muted' ? ' chip-closed' : '';
  return <span className={`chip${toneClass}`}>{label}</span>;
}
