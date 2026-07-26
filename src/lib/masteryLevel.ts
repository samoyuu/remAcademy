import type { MasteryLevel } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mirrors RemNote's own native Mastery Level bucketing (Flashcard Home / Cards
 * Table), so our numbers match what the user already sees in RemNote's UI:
 *   New          - never practiced
 *   Acquiring    - interval < 3 days
 *   Growing      - 3 days <= interval < 3 weeks
 *   Solidifying  - 3 weeks <= interval < 3 months
 *   Retaining    - interval >= 3 months
 *   Stale        - overdue past its interval
 * (source: RemNote Help Center "Flashcard Statistics" article)
 */
export function masteryLevelForCard(
  lastRepetitionTime: number | undefined,
  nextRepetitionTime: number | undefined,
  now: number = Date.now()
): MasteryLevel {
  if (!lastRepetitionTime || !nextRepetitionTime) {
    return 'New';
  }

  const intervalDays = (nextRepetitionTime - lastRepetitionTime) / DAY_MS;

  if (now > nextRepetitionTime) {
    return 'Stale';
  }
  if (intervalDays < 3) {
    return 'Acquiring';
  }
  if (intervalDays < 21) {
    return 'Growing';
  }
  if (intervalDays < 90) {
    return 'Solidifying';
  }
  return 'Retaining';
}

// Cards at this level or above count toward the dashboard's "% mastered" figure.
const MASTERY_ORDER: MasteryLevel[] = [
  'New',
  'Acquiring',
  'Growing',
  'Solidifying',
  'Retaining',
];

export function isCountedAsMastered(level: MasteryLevel, bar: MasteryLevel = 'Solidifying'): boolean {
  if (level === 'Stale') return false;
  return MASTERY_ORDER.indexOf(level) >= MASTERY_ORDER.indexOf(bar);
}
