// Powerup and property codes used throughout the plugin.
// Keeping these as constants avoids typo'd string literals scattered across files.

export const LP_POWERUP = {
  // v2: the original code got stuck with malformed (empty) slots from an
  // earlier buggy registerPowerup call, and RemNote won't let you delete a
  // powerup that's still tagged onto Rem - so this is a fresh code rather
  // than trying to fix the old one in place. The old "Learning Point"
  // powerup + its tagged Rem are harmless leftover clutter, safe to ignore
  // or manually clean up later.
  code: 'qmLearningPointV2',
  name: 'Learning Point',
  properties: {
    id: 'id',
    subject: 'subject',
    chapter: 'chapter',
    section: 'section',
    type: 'type',
    stageStatus: 'stageStatus',
    masteryPct: 'masteryPct',
  },
} as const;

export const SLOW_SCHEDULE_POWERUP = {
  // v2 for the same reason as LP_POWERUP above.
  code: 'qmSlowScheduleV2',
  name: 'Slow Schedule',
  properties: {
    nextDueDate: 'nextDueDate',
    intervalDays: 'intervalDays',
    lastResult: 'lastResult',
  },
} as const;
