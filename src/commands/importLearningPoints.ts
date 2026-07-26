import type { PluginRem as Rem, RNPlugin } from '@remnote/plugin-sdk';
import { loadAllSubjects } from '../lib/subjects';
import { LP_POWERUP, SLOW_SCHEDULE_POWERUP } from '../lib/powerups';
import { isSlowTrackId, initSlowSchedule } from '../lib/slowSchedule';
import type { LearningPoint, SubjectData } from '../lib/types';

// Default subject for the "Add Learning Point" popup form only. Bulk import
// always gets its subject label from each src/data/subjects/*.json file.
const SUBJECT_LABEL = 'QM';

export async function registerPowerupsAndTags(plugin: RNPlugin) {
  await plugin.app.registerPowerup({
    name: LP_POWERUP.name,
    code: LP_POWERUP.code,
    description: 'A single atomic learning point from the QM knowledge graph.',
    options: {
      slots: [
        { code: LP_POWERUP.properties.id, name: 'ID', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.subject, name: 'Subject', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.chapter, name: 'Chapter', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.section, name: 'Section', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.type, name: 'Type', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.stageStatus, name: 'Stage Status', onlyProgrammaticModifying: true },
        { code: LP_POWERUP.properties.masteryPct, name: 'Mastery %', onlyProgrammaticModifying: true },
      ],
    },
  });

  await plugin.app.registerPowerup({
    name: SLOW_SCHEDULE_POWERUP.name,
    code: SLOW_SCHEDULE_POWERUP.code,
    description: 'Custom long-interval scheduling state for multi-part end-of-chapter problems.',
    options: {
      slots: [
        { code: SLOW_SCHEDULE_POWERUP.properties.nextDueDate, name: 'Next Due Date', onlyProgrammaticModifying: true },
        { code: SLOW_SCHEDULE_POWERUP.properties.intervalDays, name: 'Interval (days)', onlyProgrammaticModifying: true },
        { code: SLOW_SCHEDULE_POWERUP.properties.lastResult, name: 'Last Result', onlyProgrammaticModifying: true },
      ],
    },
  });
}

/**
 * Finds/creates a child Rem matched by its leading "number" token (before
 * `delimiter`), ignoring whatever title text follows - so a title-less
 * lookup ("Chapter 1") still finds an existing titled container ("Chapter 1:
 * Key Features...") instead of spawning a duplicate, and vice versa. This is
 * what lets the "Add Learning Point" popup skip asking for chapter/section
 * titles: you just rename the container by hand in RemNote once, and every
 * later add under that same number reuses it untouched.
 */
async function findOrCreateNumberedChild(
  plugin: RNPlugin,
  parent: Rem,
  head: string,
  title: string,
  delimiter: string
): Promise<Rem> {
  const children = await parent.getChildrenRem();
  for (const child of children) {
    const childText = (await plugin.richText.toString(child.text ?? [])).trim();
    if (childText.split(delimiter)[0].trim() === head) return child;
  }
  const rem = await plugin.rem.createRem();
  await rem!.setText([title ? `${head}${delimiter}${title}` : head]);
  await rem!.setParent(parent._id);
  return rem!;
}

/** Root-level lookup (findByName(..., null) only matches top-level Rem) so
 * re-running import/add doesn't spawn a duplicate subject document each time. */
async function findOrCreateSubjectDoc(plugin: RNPlugin, subjectLabel: string): Promise<Rem> {
  const existing = await plugin.rem.findByName([subjectLabel], null);
  if (existing) return existing;
  const rem = await plugin.rem.createRem();
  await rem!.setText([subjectLabel]);
  await rem!.setIsDocument(true);
  return rem!;
}

async function findExistingLPRem(plugin: RNPlugin, sectionRem: Rem, id: string): Promise<Rem | undefined> {
  const children = await sectionRem.getChildrenRem();
  for (const child of children) {
    const existingId = await child.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.id);
    if (existingId === id) return child;
  }
  return undefined;
}

/**
 * Creates (or backfills) a single learning point's Chapter -> Section ->
 * LearningPoint outline entry, tagged with LP_POWERUP and its metadata.
 * Idempotent by (section, id) - safe to call repeatedly. Shared by both the
 * bulk JSON importer and the single-LP "Add Learning Point" command.
 */
export async function upsertLearningPoint(
  plugin: RNPlugin,
  lp: LearningPoint,
  subjectLabel: string = SUBJECT_LABEL
): Promise<{ created: boolean }> {
  const subjectRem = await findOrCreateSubjectDoc(plugin, subjectLabel);
  const chapterRem = await findOrCreateNumberedChild(
    plugin,
    subjectRem,
    `Chapter ${lp.chapter}`,
    lp.chapterTitle ?? '',
    ': '
  );
  const sectionRem = await findOrCreateNumberedChild(plugin, chapterRem, lp.section, lp.sectionTitle ?? '', ' ');

  const bulletText = `[${subjectLabel} ${lp.id}] (${lp.type}) ${lp.description}`;
  const existing = await findExistingLPRem(plugin, sectionRem, lp.id);
  if (existing) {
    // Backfill: LPs created before setIsDocument/the subject prefix were
    // added need these too, otherwise they can't be found/disambiguated in
    // the # tag-reference search used to link flashcards to their LP.
    await existing.setIsDocument(true);
    await existing.setText([bulletText]);
    await existing.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.subject, [subjectLabel]);
    return { created: false };
  }

  const lpRem = await plugin.rem.createRem();
  await lpRem!.setText([bulletText]);
  await lpRem!.setParent(sectionRem._id);
  await lpRem!.setIsDocument(true);
  await lpRem!.addPowerup(LP_POWERUP.code);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.id, [lp.id]);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.subject, [subjectLabel]);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.chapter, [String(lp.chapter)]);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.section, [lp.section]);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.type, [lp.type]);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.stageStatus, ['Not Started']);
  await lpRem!.setPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.masteryPct, ['0']);

  if (isSlowTrackId(lp.id)) {
    // Multi-part end-of-chapter problems are one-off: the LP bullet itself
    // becomes the flashcard (no separate child card needed) - fill in your
    // worked solution as the back text before your first attempt.
    await lpRem!.setIsCardItem(true);
    await lpRem!.setBackText(['(add your worked solution here)']);
    await initSlowSchedule(lpRem!);
  }

  return { created: true };
}

async function importSubjectDatas(plugin: RNPlugin, subjects: SubjectData[]) {
  await registerPowerupsAndTags(plugin);

  let created = 0;
  let skipped = 0;
  for (const subjectData of subjects) {
    for (const lp of subjectData.learningPoints as LearningPoint[]) {
      const result = await upsertLearningPoint(plugin, lp, subjectData.subject);
      if (result.created) created++;
      else skipped++;
    }
  }

  await plugin.app.toast(
    `Import complete: ${created} learning points created, ${skipped} already existed, across ${subjects.length} subject(s).`
  );
}

/**
 * Idempotent import of every src/data/subjects/*.json file: builds each
 * subject's Chapter -> Section -> LearningPoint outline, tagging each LP
 * with the LP_POWERUP and its metadata. Safe to re-run.
 */
export async function importLearningPoints(plugin: RNPlugin) {
  try {
    await importSubjectDatas(plugin, loadAllSubjects());
  } catch (err: any) {
    console.error('qm-lp-tracker: import failed', err);
    await plugin.app.toast(`Import failed: ${err?.message ?? err}`);
  }
}

/** Same as importLearningPoints, but scoped to a single subject file - lets
 * "select a file to import" happen via RemNote's own command palette
 * (one command gets registered per subject, see index.tsx). */
export async function importSingleSubject(plugin: RNPlugin, subjectLabel: string) {
  try {
    const subjectData = loadAllSubjects().find((s) => s.subject === subjectLabel);
    if (!subjectData) {
      await plugin.app.toast(`No subject file found for "${subjectLabel}".`);
      return;
    }
    await importSubjectDatas(plugin, [subjectData]);
  } catch (err: any) {
    console.error('qm-lp-tracker: import failed', err);
    await plugin.app.toast(`Import failed: ${err?.message ?? err}`);
  }
}
