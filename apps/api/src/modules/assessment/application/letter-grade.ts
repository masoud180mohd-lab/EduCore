/**
 * Derived letter grade for report cards (ACF-011 v1.2). Not stored.
 * Scale: A ≥80, B ≥70, C ≥60, D ≥50, F below.
 */
export function percentageScore(score: number | null, maxScore: number): number | null {
  if (score === null || !Number.isFinite(score) || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

export function letterGrade(percent: number | null): string | null {
  if (percent === null) return null;
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
}
