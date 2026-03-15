import { readdir } from 'fs/promises';
import { generateSceneRegistry } from '../scene-registry-generator.js';

const SCENES_DIR = '/workspace/src/scenes';

/**
 * Regenerate the scene registry and return the list of scene files found.
 * Wraps the existing generateSceneRegistry() and adds file-list return value.
 */
export async function regenerateSceneRegistry(): Promise<string[]> {
  // Generate the registry file using existing generator
  await generateSceneRegistry();

  // Return the sorted list of scene files
  let files: string[] = [];
  try {
    files = await readdir(SCENES_DIR);
  } catch {
    // scenes/ dir may not exist yet
  }

  return files
    .filter((f) => /\.(tsx|ts)$/.test(f) && !f.startsWith('.'))
    .sort();
}
