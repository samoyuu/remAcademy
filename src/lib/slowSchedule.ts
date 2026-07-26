import type { PluginRem as Rem, RNPlugin } from '@remnote/plugin-sdk';
import { QueueInteractionScore } from '@remnote/plugin-sdk';
import { SLOW_SCHEDULE_POWERUP } from './powerups';

const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_INTERVAL_DAYS = 5;
const GROWTH_FACTOR = 2.5; // successful repetition -> interval * this, capped below
const MAX_INTERVAL_DAYS = 180;
const FAILURE_INTERVAL_DAYS = 5; // reset target on Again/Hard, not back to zero

/**
 * A learning point counts as "slow track" (multi-part end-of-chapter Problem,
 * not a quick in-text Exercise) if its ID has the "<chapter>.P<n>" shape,
 * e.g. "6.P3" - two dot-separated segments, second starting with "P" - versus
 * a regular "6.5.3" three-segment id for everything else.
 */
export function isSlowTrackId(lpId: string): boolean {
  const parts = lpId.split('.');
  return parts.length === 2 && parts[1].startsWith('P');
}

/** Derives {chapter, section} from an id's shape ("6.5.3" or slow-track "6.P3"). */
export function deriveChapterSection(lpId: string): { chapter: number; section: string } | null {
  const slow = lpId.match(/^(\d+)\.P\d+$/);
  if (slow) return { chapter: Number(slow[1]), section: `${slow[1]}.P` };
  const normal = lpId.match(/^(\d+)\.(\d+)\.\d+$/);
  if (normal) return { chapter: Number(normal[1]), section: `${normal[1]}.${normal[2]}` };
  return null;
}

async function getSchedule(rem: Rem): Promise<{ nextDueDate: number; intervalDays: number } | null> {
  const hasIt = await rem.hasPowerup(SLOW_SCHEDULE_POWERUP.code);
  if (!hasIt) return null;
  const nextDueDate = Number(
    await rem.getPowerupProperty(SLOW_SCHEDULE_POWERUP.code, SLOW_SCHEDULE_POWERUP.properties.nextDueDate)
  );
  const intervalDays = Number(
    await rem.getPowerupProperty(SLOW_SCHEDULE_POWERUP.code, SLOW_SCHEDULE_POWERUP.properties.intervalDays)
  );
  return { nextDueDate, intervalDays };
}

async function writeSchedule(rem: Rem, nextDueDate: number, intervalDays: number, lastResult?: string) {
  await rem.setPowerupProperty(SLOW_SCHEDULE_POWERUP.code, SLOW_SCHEDULE_POWERUP.properties.nextDueDate, [
    String(nextDueDate),
  ]);
  await rem.setPowerupProperty(SLOW_SCHEDULE_POWERUP.code, SLOW_SCHEDULE_POWERUP.properties.intervalDays, [
    String(intervalDays),
  ]);
  if (lastResult) {
    await rem.setPowerupProperty(SLOW_SCHEDULE_POWERUP.code, SLOW_SCHEDULE_POWERUP.properties.lastResult, [
      lastResult,
    ]);
  }
}

/** Called once, the first time a slow-track card is imported/created. */
export async function initSlowSchedule(rem: Rem) {
  await rem.addPowerup(SLOW_SCHEDULE_POWERUP.code);
  // Due immediately so it surfaces the first time you actually get to it.
  await writeSchedule(rem, Date.now(), INITIAL_INTERVAL_DAYS);
  await rem.setEnablePractice(true);
}

/**
 * Runs on vault open / manual recompute: flips practice on for any slow-track
 * card whose stored due date has arrived, off otherwise. This is what
 * replaces RemNote's own native scheduling for these cards.
 */
export async function refreshSlowTrackGating(plugin: RNPlugin, slowTrackRems: Rem[]) {
  const now = Date.now();
  for (const rem of slowTrackRems) {
    const schedule = await getSchedule(rem);
    if (!schedule) continue;
    await rem.setEnablePractice(schedule.nextDueDate <= now);
  }
}

/**
 * Called right after a slow-track card is graded (see the QueueCompleteCard
 * hook). Computes our own next interval instead of trusting whatever RemNote's
 * native algorithm just assigned, then re-disables practice until that date.
 */
export async function onSlowCardGraded(rem: Rem, score: QueueInteractionScore) {
  const schedule = await getSchedule(rem);
  const currentInterval = schedule?.intervalDays ?? INITIAL_INTERVAL_DAYS;

  const succeeded = score === QueueInteractionScore.GOOD || score === QueueInteractionScore.EASY;
  const nextInterval = succeeded
    ? Math.min(currentInterval * GROWTH_FACTOR, MAX_INTERVAL_DAYS)
    : FAILURE_INTERVAL_DAYS;

  const nextDueDate = Date.now() + nextInterval * DAY_MS;
  await writeSchedule(rem, nextDueDate, nextInterval, QueueInteractionScore[score]);
  await rem.setEnablePractice(false);
}
