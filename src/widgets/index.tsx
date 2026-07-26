import { AppEvents, declareIndexPlugin, WidgetLocation, type ReactRNPlugin } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

import { importLearningPoints, importSingleSubject, registerPowerupsAndTags } from '../commands/importLearningPoints';
import { recomputeAll } from '../commands/recomputeAll';
import { removeLearningPoint } from '../commands/removeLearningPoint';
import { LP_POWERUP, SLOW_SCHEDULE_POWERUP } from '../lib/powerups';
import { computeLPState, writeLPState } from '../lib/lpState';
import { onSlowCardGraded } from '../lib/slowSchedule';
import { loadAllSubjects } from '../lib/subjects';

async function onActivate(plugin: ReactRNPlugin) {
  try {
    // Must run on every activation, not just when the user happens to run
    // "Import Learning Points" - getPowerupByCode only resolves powerups
    // registered in the current plugin session, so skipping this on reload
    // orphans previously-registered powerups (and the dashboard can't find
    // them even though their tagged Rem still exist in the graph).
    await registerPowerupsAndTags(plugin);

    await plugin.app.registerCommand({
      id: 'ls-import-learning-points',
      name: 'LS: Import Learning Points (All Subjects)',
      action: async () => importLearningPoints(plugin),
    });

    // One command per subject file so "select a file to import" is just
    // typing "LS: Import —" in RemNote's own command palette - no custom
    // picker UI needed, and it stays in sync automatically as subject files
    // are added/removed (registered fresh on every activation).
    for (const subjectData of loadAllSubjects()) {
      await plugin.app.registerCommand({
        id: `ls-import-subject-${subjectData.subject}`,
        name: `LS: Import — ${subjectData.subject}`,
        action: async () => importSingleSubject(plugin, subjectData.subject),
      });
    }

    await plugin.app.registerCommand({
      id: 'ls-recompute-all',
      name: 'LS: Recompute All Learning Point Progress',
      action: async () => recomputeAll(plugin),
    });

    await plugin.app.registerCommand({
      id: 'ls-add-learning-point',
      name: 'LS: Add Learning Point',
      action: async () => plugin.widget.openPopup('addLearningPoint'),
    });

    await plugin.app.registerCommand({
      id: 'ls-remove-learning-point',
      name: 'LS: Remove Learning Point (Focused Rem)',
      action: async () => removeLearningPoint(plugin),
    });

    await plugin.app.registerWidget('dashboard', WidgetLocation.RightSidebar, {
      dimensions: { height: 'auto', width: '100%' },
      widgetTabTitle: 'LS Dashboard',
      widgetTabIcon: '📊',
    });

    await plugin.app.registerWidget('addLearningPoint', WidgetLocation.Popup, {
      dimensions: { height: 'auto', width: 'auto' },
    });

    await plugin.app.toast('QM plugin activated: commands + dashboard widget registered.');
  } catch (err: any) {
    // onActivate has no caller to report to, so if anything in it throws
    // (including registerWidget itself), everything after the failure point
    // silently never runs - surface it loudly instead.
    console.error('qm-lp-tracker: onActivate failed', err);
    await plugin.app.toast(`QM plugin activation failed: ${err?.message ?? err}`);
    throw err;
  }

  // Recompute (cheap, single-LP) whenever a card is completed in the queue.
  //
  // NOTE (unverified): `plugin.event.addListener` is used here as the
  // imperative equivalent of the `useAPIEventListener` React hook shown in
  // the docs (that hook is for use inside components; onActivate isn't one).
  // If this method name/signature is wrong, the fix is to instead register a
  // tiny always-mounted widget whose only job is to call
  // `useAPIEventListener(AppEvents.QueueCompleteCard, undefined, ...)`.
  //
  // NOTE (unverified): the exact payload shape of QueueCompleteCard isn't
  // fully documented. This assumes it carries *something* identifying the
  // just-answered card (remId/cardId) and the score given. If it turns out
  // the payload is empty or doesn't include the score, fall back to
  // `plugin.queue.getCurrentCard()` - but be aware that may already point at
  // the *next* card by the time this fires, which would need re-checking
  // against a live vault. The manual "Recompute All" command is the safety
  // net if this hook doesn't behave as expected.
  plugin.event.addListener(AppEvents.QueueCompleteCard, undefined, async (event: any) => {
    try {
      const remId = event?.remId ?? event?.cardRemId ?? event?.card?.remId;
      const score = event?.score ?? event?.grade;
      if (!remId) return;

      const rem = await plugin.rem.findOne(remId);
      if (!rem) return;

      const isSlowTrackCard = await rem.hasPowerup(SLOW_SCHEDULE_POWERUP.code);
      if (isSlowTrackCard) {
        if (score !== undefined) {
          await onSlowCardGraded(rem, score);
        }
        return;
      }

      // Fast-track card: find the LP(s) it belongs to (tagged with, or a
      // direct child of - see remsForLP in lpState.ts) and refresh their own
      // mastery numbers. Cross-LP prerequisite gating (unlocking Problem-skill
      // LPs) only runs via "LS: Recompute All" - see recomputeAll.ts.
      const tags = await rem.getTagRems();
      const parent = await rem.getParentRem();
      const candidateLPs = parent ? [...tags, parent] : tags;
      for (const candidate of candidateLPs) {
        const isLP = await candidate.hasPowerup(LP_POWERUP.code);
        if (!isLP) continue;
        const state = await computeLPState(plugin, candidate);
        await writeLPState(plugin, candidate, state);
      }
    } catch (err) {
      console.error('qm-lp-tracker: QueueCompleteCard handler failed', err);
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
