import type { Card, PluginRem as Rem, RNPlugin } from '@remnote/plugin-sdk';
import { QueueInteractionScore } from '@remnote/plugin-sdk';
import { LP_POWERUP } from './powerups';
import { isCountedAsMastered, masteryLevelForCard } from './masteryLevel';
import type { StageStatus } from './types';

const GOOD_OR_BETTER = [QueueInteractionScore.GOOD, QueueInteractionScore.EASY];

/**
 * NOTE (unverified): assumes `card.repetitionHistory` is an array of entries
 * that each expose the score given (either the raw enum value, or an object
 * with a `.score`/`.grade` field). Confirm the real shape against a live card
 * the first time this runs and adjust the accessor below if it's shaped
 * differently.
 */
function lastTwoScores(card: Card): QueueInteractionScore[] {
  const history = ((card as any).repetitionHistory ?? []) as any[];
  const tail = history.slice(-2);
  return tail.map((entry) => (typeof entry === 'object' ? entry.score ?? entry.grade : entry));
}

function isCardMastered(card: Card): boolean {
  const last2 = lastTwoScores(card);
  return last2.length === 2 && last2.every((s) => GOOD_OR_BETTER.includes(s));
}

/**
 * A Rem "belongs to" an LP either by explicit tag (`#1.1.1`) or, more
 * conveniently, just by being a direct child of the LP bullet in the
 * outline - so you only have to tag flashcards with the LP tag, or just
 * nest them under it, whichever's more convenient while authoring.
 */
export async function remsForLP(lpRem: Rem): Promise<Rem[]> {
  const [tagged, children] = await Promise.all([lpRem.taggedRem(), lpRem.getChildrenRem()]);
  const byId = new Map<string, Rem>();
  for (const rem of [...tagged, ...children]) byId.set(rem._id, rem);
  return [...byId.values()];
}

async function cardsForLP(lpRem: Rem): Promise<Card[]> {
  const candidates = await remsForLP(lpRem);
  const cards: Card[] = [];
  for (const rem of candidates) cards.push(...(await rem.getCards()));
  return cards;
}

export interface LPComputedState {
  stageStatus: StageStatus;
  mastered: boolean;
  masteryPct: number;
}

function allMastered(cards: Card[]): boolean {
  return cards.length > 0 && cards.every(isCardMastered);
}

function computeMasteryPct(cards: Card[]): number {
  if (cards.length === 0) return 0;
  const masteredCount = cards.filter(
    (c) => isCountedAsMastered(masteryLevelForCard(c.lastRepetitionTime, c.nextRepetitionTime))
  ).length;
  return Math.round((masteredCount / cards.length) * 100);
}

/**
 * Computes an LP's own mastery from its own cards - no cross-LP prerequisite
 * logic here (see [[project-qm-remnote-plugin]] for why the old
 * core/example/problem intra-LP staging was retired: Concept/Example/
 * Problem-skill are already separate LPs via `type`, so gating now happens
 * across LPs via the JSON `prerequisites` graph instead - see recomputeAll.ts).
 */
export async function computeLPState(plugin: RNPlugin, lpRem: Rem): Promise<LPComputedState> {
  const cards = await cardsForLP(lpRem);
  const mastered = allMastered(cards);
  const stageStatus: StageStatus = cards.length === 0 ? 'Not Started' : mastered ? 'Mastered' : 'In Progress';
  const masteryPct = computeMasteryPct(cards);
  return { stageStatus, mastered, masteryPct };
}

/** Enables/disables every card belonging to an LP (no per-stage distinction anymore). */
export async function setLPPracticeEnabled(lpRem: Rem, enabled: boolean) {
  const candidates = await remsForLP(lpRem);
  for (const rem of candidates) {
    await rem.setEnablePractice(enabled);
  }
}

export async function writeLPState(plugin: RNPlugin, lpRem: Rem, state: LPComputedState) {
  await lpRem.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.stageStatus, [state.stageStatus]);
  await lpRem.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.masteryPct, [String(state.masteryPct)]);
}
