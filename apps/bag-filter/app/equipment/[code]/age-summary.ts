import { ageHours, bagAgeScaleDays } from '@plant/contracts';

/** Snapshot entries are current installations, not the full replacement history. */
export function activeAgeSummary(positions: Iterable<{ installedAt: string | null }>, now: number) {
  let min: number | null = null,
    max: number | null = null,
    old = 0,
    recorded = 0;
  for (const position of positions) {
    const hours = ageHours(position.installedAt, now);
    if (hours === null || !Number.isFinite(hours)) continue;
    const days = Math.floor(hours / 24);
    min = min === null ? days : Math.min(min, days);
    max = max === null ? days : Math.max(max, days);
    if (days >= bagAgeScaleDays) old++;
    recorded++;
  }
  return { min, max, old, recorded };
}
