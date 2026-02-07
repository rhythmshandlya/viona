/**
 * Claude Agent SDK based visual generation
 *
 * Uses Claude's built-in tools (Read, Write, Edit, Bash, Glob, Grep)
 * for autonomous visual generation with validation.
 */

export { generateVisualsWithClaudeSDK } from './visual-generator.js';
export type {
  ClaudeVisualOptions,
  VisualGenerationResult,
  VisualPlan,
  PlannedScene,
  TranscriptWord,
} from './visual-generator.js';
