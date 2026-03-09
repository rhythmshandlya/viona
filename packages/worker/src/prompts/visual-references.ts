import { loadPrompt, loadTemplate } from './loader.js';

const COMMON_PATTERNS = loadPrompt('references/common-patterns');

/**
 * Build the reference examples section for the visual generation prompt.
 * Loads examples from .md files and substitutes the projectId.
 */
export function buildReferenceExamplesSection(projectId: string): string {
  const searchRace = loadTemplate('references/search-race', { projectId });
  const stackOverflow = loadTemplate('references/stack-overflow', { projectId });
  const hashCollisions = loadTemplate('references/hash-collisions', { projectId });

  return `${COMMON_PATTERNS}\n\n${searchRace}\n\n${stackOverflow}\n\n${hashCollisions}`;
}
