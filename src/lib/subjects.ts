import type { SubjectData } from './types';

// Auto-loads every src/data/subjects/*.json at build time - drop a new
// subject file in, no code changes needed for it to show up on next import.
const context = require.context('../data/subjects', false, /\.json$/);

export function loadAllSubjects(): SubjectData[] {
  return context.keys().map((key) => context<SubjectData>(key));
}

/**
 * Keyed by "subject::id" (prereq ids are only unique within their own
 * subject's file) - maps a learning point to the ids of the prereqs it
 * requires, e.g. what a Problem-skill LP needs mastered before it unlocks.
 */
export function loadPrereqIndex(): Record<string, string[]> {
  return loadAllSubjects().reduce<Record<string, string[]>>((acc, s) => {
    for (const e of s.prerequisites) {
      const key = `${s.subject}::${e.requiresFor}`;
      (acc[key] ??= []).push(e.prereq);
    }
    return acc;
  }, {});
}
