// packages/sandbox/src/prompt-assembly.ts
//
// Per-scene prompt assembly for the Animator subagent.
// The Animator's system prompt lives in prompts/animator/system.md (loaded by assembleAgentPrompt).
// This module builds the per-scene USER message that Viona passes when dispatching each Animator.
// It provides scene-specific context: brief, dimensions, display mode, sync points.

import { readFile } from 'fs/promises';
import { join } from 'path';

const WORKSPACE = '/workspace';

// ---- Types ----

export interface SceneConfig {
  sceneName: string;
  sceneFile: string;
  sceneBrief: string;          // visual description from the plan
  syncPoints: Array<{ frame: number; action: string }>;
  durationFrames: number;
  canvasWidth: number;         // full canvas width (for reference)
  canvasHeight: number;        // full canvas height (for reference)
  sceneWidth: number;          // actual scene render width
  sceneHeight: number;         // actual scene render height
  fps: number;
  theme: string;
  displayMode: 'fullscreen' | 'split-screen' | 'overlay';
}

// ---- Display mode context ----

function displayModeContext(config: SceneConfig): string {
  switch (config.displayMode) {
    case 'overlay':
      return `
### Display Mode: Overlay
- This scene renders ON TOP of the speaker video at ${config.sceneWidth}×${config.sceneHeight}
- Root container MUST be transparent — NO Background component, NO background color
- Use glass cards for elements (they have their own semi-transparent backgrounds)
- Maximum 3-4 visible elements — overlays supplement, not compete
- All text needs \`textShadow\` for readability over video
- Keep animations subtle and focused`;

    case 'split-screen':
      return `
### Display Mode: Stacked (split-screen)
- Your scene occupies the top ${config.sceneHeight}px — speaker is visible below
- Include the <Background> component
- Extra padding near bottom edge (split boundary)
- Key elements should be bold and readable at a glance — attention is divided`;

    case 'fullscreen':
      return `
### Display Mode: Fullscreen
- You have the full canvas — speaker is hidden during this scene
- Include the <Background> component with a rich animated gradient
- Go bold — this is your moment to fill the space`;
  }
}

// ---- Scene brief formatting ----

function formatSceneBrief(config: SceneConfig): string {
  const syncPointsText = config.syncPoints.length > 0
    ? config.syncPoints.map(sp => `  - Frame ${sp.frame}: ${sp.action}`).join('\n')
    : '  (no sync points specified)';

  return `## SCENE ASSIGNMENT

- **Scene name:** ${config.sceneName}
- **Skeleton file:** \`src/scenes/${config.sceneFile}.tsx\` (already exists — read it first, then edit)
- **Display mode:** ${config.displayMode}
- **Render size:** ${config.sceneWidth}×${config.sceneHeight}
- **Duration:** ${config.durationFrames} frames (${(config.durationFrames / config.fps).toFixed(1)}s)
- **Canvas:** ${config.canvasWidth}×${config.canvasHeight} @ ${config.fps}fps

### Visual Brief

${config.sceneBrief}

### Sync Points

${syncPointsText}

${displayModeContext(config)}

### Your Task

1. **Read** the skeleton file at \`src/scenes/${config.sceneFile}.tsx\` — it has imports, DATA, dimensions, and component structure ready
2. **Edit** the skeleton to add dense, choreographed animation (replace placeholder comments with real code)
3. Keep the existing DATA object, SCENE_WIDTH, SCENE_HEIGHT, and metadata comments
4. Add animation logic: spring entrances, liquid glass, idle motion, decorative layers
5. **Verify:** \`npx tsc --noEmit\` → \`trigger_rebuild\` → \`render_still\` at a key frame
`;
}

// ---- Main assembly function ----

/**
 * Build a per-scene dispatch message for the Animator subagent.
 *
 * This is NOT the system prompt (that's in prompts/animator/system.md).
 * This is the user message Viona sends when dispatching each Animator
 * with scene-specific context: brief, dimensions, sync points, display mode.
 */
export async function buildAnimatorPrompt(config: SceneConfig): Promise<string> {
  return formatSceneBrief(config);
}
