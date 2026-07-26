import type { RNPlugin } from '@remnote/plugin-sdk';
import { LP_POWERUP } from '../lib/powerups';

/**
 * Deletes the currently-focused Rem, provided it's an LP bullet - put your
 * cursor on/select the LP in RemNote's editor before running this command.
 * `.remove()` deletes descendants too, so a fast-track LP's core/example/
 * problem child cards go with it in one call. IDs are opaque keys (not
 * indices - see [[qm-remnote-subject-json-schema]]), so no other LP needs
 * renumbering after this.
 */
export async function removeLearningPoint(plugin: RNPlugin) {
  const rem = await plugin.focus.getFocusedRem();
  if (!rem) {
    await plugin.app.toast('No Rem focused - click into the learning point bullet first.');
    return;
  }

  const id = await rem.getPowerupProperty(LP_POWERUP.code, LP_POWERUP.properties.id);
  if (!id) {
    await plugin.app.toast('Focused Rem is not a learning point (missing LP powerup).');
    return;
  }

  await rem.remove();
  await plugin.app.toast(`Removed learning point ${id}.`);
}
