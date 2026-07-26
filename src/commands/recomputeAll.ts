import type { PluginRem as Rem, RNPlugin } from '@remnote/plugin-sdk';
import { LP_POWERUP } from '../lib/powerups';
import { computeLPState, setLPPracticeEnabled, writeLPState } from '../lib/lpState';
import { isSlowTrackId, refreshSlowTrackGating } from '../lib/slowSchedule';
import { loadPrereqIndex } from '../lib/subjects';

interface LPEntry {
  rem: Rem;
  subject: string;
  id: string;
  type: string;
  mastered: boolean;
}

/**
 * Full manual rescan: recomputes stageStatus/masteryPct for every learning
 * point, then gates Problem-skill LPs behind their prerequisite LPs (see
 * [[project-qm-remnote-plugin]] - Concept/Definition/Derivation/Example LPs
 * are always practiceable immediately per the "create + review right away,
 * except problems" workflow; only Problem-skill LPs wait on prereq mastery).
 * This is the only place prereq gating runs - the QueueCompleteCard hook only
 * updates a single LP's own numbers, so run this (or hit Refresh) after
 * adding new cards and before reviewing to gate freshly-added problems.
 */
export async function recomputeAll(plugin: RNPlugin) {
  const lpPowerupRem = await plugin.powerup.getPowerupByCode(LP_POWERUP.code);
  if (!lpPowerupRem) {
    await plugin.app.toast('Learning Point powerup not found - run the import command first.');
    return;
  }

  const allLPRems = await lpPowerupRem.taggedRem();
  const slowTrackRems: Rem[] = [];
  const bySubjectAndId = new Map<string, LPEntry>();

  // Pass 1: each LP's own mastery, from its own cards only.
  for (const lpRem of allLPRems) {
    const id = String((await lpRem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.id)) ?? '').trim();
    const subject = String(
      (await lpRem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.subject)) ?? ''
    ).trim();
    const type = String((await lpRem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.type)) ?? '').trim();

    if (isSlowTrackId(id)) {
      slowTrackRems.push(lpRem); // slow-track LPs are their own flashcard - separate scheduling path, not prereq-gated
      continue;
    }

    const state = await computeLPState(plugin, lpRem);
    await writeLPState(plugin, lpRem, state);
    bySubjectAndId.set(`${subject}::${id}`, { rem: lpRem, subject, id, type, mastered: state.mastered });
  }

  // Pass 2: gate Problem-skill LPs behind their prerequisites (now that every
  // LP's fresh mastery is known); everything else stays unlocked.
  const prereqsBySubjectAndId = loadPrereqIndex();
  for (const entry of bySubjectAndId.values()) {
    if (entry.type !== 'Problem-skill') {
      await setLPPracticeEnabled(entry.rem, true);
      continue;
    }
    const prereqIds = prereqsBySubjectAndId[`${entry.subject}::${entry.id}`] ?? [];
    const unlocked = prereqIds.every((pid) => bySubjectAndId.get(`${entry.subject}::${pid}`)?.mastered ?? false);
    await setLPPracticeEnabled(entry.rem, unlocked);
  }

  await refreshSlowTrackGating(plugin, slowTrackRems);

  await plugin.app.toast(`Recomputed ${allLPRems.length} learning points.`);
}
