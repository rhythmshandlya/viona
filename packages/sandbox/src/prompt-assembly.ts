// packages/sandbox/src/prompt-assembly.ts
//
// Layered prompt assembly for Animator subagents.
// The orchestrator CODE (not Viona) assembles a focused prompt per-scene
// from modular pieces based on display mode, theme, and scene brief.

import { readFile } from 'fs/promises';
import { join } from 'path';

const WORKSPACE = '/workspace';

// ---- Types ----

export type DisplayMode = 'default' | 'fullscreen' | 'overlay';

export interface SceneConfig {
  sceneName: string;
  sceneFile: string;
  displayMode: DisplayMode;
  splitRatio: number;          // e.g. 55 (percentage)
  sceneBrief: string;          // visual description from the plan
  syncPoints: Array<{ frame: number; action: string }>;
  durationFrames: number;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  theme: string;
}

export interface EffectiveDimensions {
  width: number;
  height: number;
  position: 'video-bottom' | 'video-top' | 'full' | 'overlay';
}

// ---- Dimension computation ----

/**
 * Compute effective dimensions for a scene based on display mode and split ratio.
 * This is pure math — no AI involved.
 */
export function computeEffectiveDimensions(
  canvasWidth: number,
  canvasHeight: number,
  displayMode: DisplayMode,
  splitRatio: number,
): EffectiveDimensions {
  switch (displayMode) {
    case 'default': // stacked
      return {
        width: canvasWidth,
        height: Math.round(canvasHeight * (splitRatio / 100)),
        position: 'video-bottom',
      };
    case 'fullscreen':
      return {
        width: canvasWidth,
        height: canvasHeight,
        position: 'full',
      };
    case 'overlay':
      return {
        width: canvasWidth,
        height: canvasHeight,
        position: 'overlay',
      };
  }
}

// ---- Display mode rules ----

const STACKED_RULES = (dims: EffectiveDimensions) => `
## DISPLAY MODE: STACKED (default)

Your scene renders in the visual panel area. The speaker is visible in the other portion of the split.

- **Effective dimensions:** ${dims.width}×${dims.height} pixels
- **Position:** Visual on top, speaker on bottom
- Design for the visual panel area only — the speaker occupies the remaining space
- All sizes must be relative to effective width (EW) and effective height (EH)
- Content must fit entirely within ${dims.width}×${dims.height} — no overflow
- Use \`overflow: 'hidden'\` on the root container
- Bottom ~15% of the visual panel should be kept clear for potential captions
`;

const FULLSCREEN_RULES = (dims: EffectiveDimensions) => `
## DISPLAY MODE: FULLSCREEN

Your scene fills the entire canvas. The speaker video is hidden during this scene.

- **Effective dimensions:** ${dims.width}×${dims.height} pixels (full canvas)
- Full canvas available — design for the complete ${dims.width}×${dims.height} area
- **Animated background required** — no flat solid colors. Use gradients, patterns, or subtle motion
- Vertical stacking recommended for content layout
- Use sparingly (1-2 per video max) — this hides the speaker entirely
- Bottom ~15% should be kept clear for captions
`;

const OVERLAY_RULES = (dims: EffectiveDimensions) => `
## DISPLAY MODE: OVERLAY

Your scene renders on top of the speaker video with a transparent background. The speaker plays fullscreen underneath.

- **Effective dimensions:** ${dims.width}×${dims.height} pixels (full canvas, but safe zones constrain usable area)
- **TRANSPARENT background** — do NOT set any backgroundColor. No Background component.
- **Face zone OFF-LIMITS:** 15-58% Y range is where the speaker's face is. Place NOTHING here.
- **Safe zones only:**
  - Top strip: 0-15% Y — short labels (1-2 words)
  - Lower third: 58-85% Y — primary content zone
  - Subtitle area: 85-100% Y — reserved for captions
- **Max 2 elements** visible at any moment. Prefer 1.
- **1-3 words per element** — the speaker provides context verbally
- **Max 55% width** — leave breathing room around the speaker
- Text must have \`textShadow\` for readability over video
- Text opacity 1.0 at rest — no dimming
`;

// ---- Theme loading ----

async function loadThemeContent(theme: string): Promise<string> {
  const paths = [
    join(WORKSPACE, 'docs', 'themes', 'studio', 'design-system.md'),
    join(WORKSPACE, 'docs', 'themes', 'studio', `${theme.includes('light') ? 'light' : 'dark'}`, 'style-guide.md'),
  ];

  const sections: string[] = [];
  for (const p of paths) {
    try {
      const content = await readFile(p, 'utf-8');
      sections.push(content);
    } catch {
      // Theme file not found — skip
    }
  }

  if (sections.length === 0) {
    return `## THEME: ${theme}\n\nNo theme file found. Use sensible defaults.`;
  }

  return `## THEME: ${theme}\n\n${sections.join('\n\n---\n\n')}`;
}

// ---- Scene brief formatting ----

function formatSceneBrief(config: SceneConfig): string {
  const syncPointsText = config.syncPoints.length > 0
    ? config.syncPoints.map(sp => `  - Frame ${sp.frame}: ${sp.action}`).join('\n')
    : '  (no sync points specified)';

  return `
## SCENE ASSIGNMENT

- **Scene name:** ${config.sceneName}
- **Scene file:** \`scenes/${config.sceneFile}.tsx\`
- **Duration:** ${config.durationFrames} frames (${(config.durationFrames / config.fps).toFixed(1)}s)
- **Display mode:** ${config.displayMode}

### Visual Brief

${config.sceneBrief}

### Sync Points

${syncPointsText}

### Important

- Write ONLY the file \`scenes/${config.sceneFile}.tsx\`
- Import from \`../constants\` and \`../components/Background\` (already exist)
- Export the component as the default export AND as a named export matching the filename
- The component receives \`width\`, \`height\`, \`durationInFrames\`, and \`fps\` props
`;
}

// ---- Self-healing section ----

const SELF_HEALING_RULES = `
## SELF-HEALING (MANDATORY)

After writing your scene file, you MUST verify it compiles:

1. Run \`npx tsc --noEmit --pretty false\` via Bash
2. If errors appear in YOUR scene file:
   - Read the error, fix the code, save
   - Re-run tsc
   - Max 2 fix attempts
3. After tsc passes, trigger a rebuild via \`mcp__render__trigger_rebuild\`
4. Render a still via \`mcp__render__render_still\` at your key sync frame to verify visually
5. If the still shows problems (blank frame, overflow, wrong layout), fix and re-render

You are responsible for producing CLEAN, COMPILING output. There is no separate healer agent.
`;

// ---- Main assembly function ----

/**
 * Build a complete Animator prompt for a specific scene.
 * Assembles from modular pieces — deterministic, no AI involved.
 *
 * Always included:
 * - Theme design system (colors, fonts, spacing, background conventions)
 * - Animation rules (springs, interpolate clamping, stagger minimums)
 * - Self-healing instructions
 *
 * Included based on display mode (only the relevant one):
 * - Stacked rules
 * - Overlay rules
 * - Fullscreen rules
 *
 * Included per-scene:
 * - Scene brief from the plan
 * - Effective dimensions
 * - Duration in frames
 * - Sync points
 */
export async function buildAnimatorPrompt(config: SceneConfig): Promise<string> {
  const dims = computeEffectiveDimensions(
    config.canvasWidth,
    config.canvasHeight,
    config.displayMode,
    config.splitRatio,
  );

  // Load theme content
  const themeContent = await loadThemeContent(config.theme);

  // Select display mode rules
  let modeRules: string;
  switch (config.displayMode) {
    case 'default':
      modeRules = STACKED_RULES(dims);
      break;
    case 'fullscreen':
      modeRules = FULLSCREEN_RULES(dims);
      break;
    case 'overlay':
      modeRules = OVERLAY_RULES(dims);
      break;
  }

  // Assemble the prompt
  const sections = [
    `# Animator — Scene: ${config.sceneName}`,
    '',
    `Canvas: ${config.canvasWidth}×${config.canvasHeight} @ ${config.fps}fps`,
    `Effective: ${dims.width}×${dims.height} (${config.displayMode})`,
    '',
    '---',
    '',
    themeContent,
    '',
    '---',
    '',
    modeRules,
    '',
    '---',
    '',
    formatSceneBrief(config),
    '',
    '---',
    '',
    SELF_HEALING_RULES,
  ];

  return sections.join('\n');
}

/**
 * Build dispatch message for the orchestrator to send when dispatching an Animator.
 * This is the user-facing message that goes into the Agent tool's prompt field.
 */
export function buildAnimatorDispatchMessage(config: SceneConfig): string {
  const dims = computeEffectiveDimensions(
    config.canvasWidth,
    config.canvasHeight,
    config.displayMode,
    config.splitRatio,
  );

  return [
    `Create the scene file \`scenes/${config.sceneFile}.tsx\` for "${config.sceneName}".`,
    '',
    `**Display mode:** ${config.displayMode}`,
    `**Effective dimensions:** ${dims.width}×${dims.height}`,
    `**Duration:** ${config.durationFrames} frames (${(config.durationFrames / config.fps).toFixed(1)}s)`,
    '',
    `**Visual brief:**`,
    config.sceneBrief,
    '',
    `**Sync points:**`,
    ...config.syncPoints.map(sp => `- Frame ${sp.frame}: ${sp.action}`),
    '',
    `After writing the file, verify it compiles (tsc --noEmit), trigger a rebuild, and render a still at the key sync frame to verify visually.`,
  ].join('\n');
}

/**
 * Build an Animator variant system prompt for a specific display mode.
 * Called once per display mode during orchestrator initialization (3 total).
 *
 * The base prompt already contains shared modules, animation techniques,
 * and self-healing rules (from animator-system.md). This function adds:
 * - Theme design system (loaded from workspace)
 * - Display-mode-specific rules with pre-computed effective dimensions
 *
 * @param displayMode - Which display mode this variant targets
 * @param basePrompt - The base animator prompt (already context-injected)
 * @param ctx - Canvas dimensions and theme name
 */
export async function buildAnimatorVariantPrompt(
  displayMode: DisplayMode,
  basePrompt: string,
  ctx: { canvasWidth: number; canvasHeight: number; splitRatio?: number; theme?: string },
): Promise<string> {
  const splitRatio = ctx.splitRatio ?? 55;
  const dims = computeEffectiveDimensions(ctx.canvasWidth, ctx.canvasHeight, displayMode, splitRatio);

  let modeRules: string;
  switch (displayMode) {
    case 'default':
      modeRules = STACKED_RULES(dims);
      break;
    case 'fullscreen':
      modeRules = FULLSCREEN_RULES(dims);
      break;
    case 'overlay':
      modeRules = OVERLAY_RULES(dims);
      break;
  }

  const themeContent = await loadThemeContent(ctx.theme ?? 'studio-dark');

  return [basePrompt, '\n\n---\n\n', themeContent, '\n\n---\n\n', modeRules].join('');
}
