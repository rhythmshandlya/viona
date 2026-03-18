// packages/sandbox/src/prompt-assembly.ts
//
// Layered prompt assembly for the Animator subagent.
// The orchestrator CODE (not Viona) assembles a focused prompt per-scene
// from modular pieces based on theme and scene brief.
// Canvas dimensions come from the scene plan.

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
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  theme: string;
}

// ---- Layout rules ----

const LAYOUT_RULES = `
## LAYOUT & SPATIAL RULES

General principles for scene composition. All sizes must be relative to the effective
width and height provided in the scene plan.

### Motion & Direction
- Animate entrance from a consistent direction (e.g., left-to-right for new content)
- Exit animations should reverse the entrance direction
- Stagger entrances by at least 4 frames to avoid simultaneous pops

### Text Placement
- Bottom ~15% of the canvas should be kept clear for potential captions
- Text must have \`textShadow\` or a contrasting backdrop for readability
- Text opacity 1.0 at rest — no dimming

### Z-Ordering & Overflow
- Use \`overflow: 'hidden'\` on the root container
- Layer decorative elements behind content (lower z-index)
- Max 2-3 elements visible at any moment — avoid clutter

### Backgrounds
- Prefer animated backgrounds — gradients, patterns, or subtle motion
- Avoid flat solid colors unless the scene brief explicitly calls for them
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

// ---- Coding rules (NON-NEGOTIABLE) ----

const CODING_RULES = `
<rules>
## Remotion Coding Rules (NON-NEGOTIABLE)
- Use \`useCurrentFrame()\` directly. NEVER subtract scene start — frames are 0-relative inside Sequence.
- EVERY \`interpolate()\` call MUST have BOTH \`extrapolateLeft: 'clamp'\` AND \`extrapolateRight: 'clamp'\`.
- Use \`spring()\` for entrances/exits. Minimum damping: 18. Import SPRINGS from constants.ts.
- Stagger elements by 6+ frames minimum. NEVER animate all at once.
- Root container: \`overflow: 'hidden'\`.
- All sizes relative to effective width/height (EW/EH). No hardcoded pixels.
- No \`Math.sin()\`/\`Math.cos()\` on text positions (causes jitter).
- No CSS \`animation\` property — use Remotion \`interpolate\`/\`spring\`.
- Scene files: \`export default\` for the component.
- Import from \`../constants\` and \`../components/Background\`.
- After writing, verify: \`npx tsc --noEmit\`, then \`trigger_rebuild\`, then \`render_still\` at key sync frame.
</rules>
`;

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
 * - Layout rules (motion direction, text placement, z-ordering)
 * - Self-healing instructions
 *
 * Included per-scene:
 * - Scene brief from the plan
 * - Duration in frames
 * - Sync points
 */
export async function buildAnimatorPrompt(config: SceneConfig): Promise<string> {
  // Load theme content
  const themeContent = await loadThemeContent(config.theme);

  // Assemble the prompt — this is the ONLY prompt source for the Animator.
  // No separate system.md. Skills are injected via SDK skills field.
  const sections = [
    `<role>You are a motion graphics engineer. Write one Remotion .tsx scene file based on the brief below. You decide HOW to animate — techniques, spring physics, choreography.</role>`,
    '',
    `Canvas: ${config.canvasWidth}×${config.canvasHeight} @ ${config.fps}fps`,
    '',
    CODING_RULES,
    '',
    themeContent,
    '',
    LAYOUT_RULES,
    '',
    formatSceneBrief(config),
    '',
    SELF_HEALING_RULES,
    '',
    `<critical_reminder>`,
    `EVERY interpolate() needs extrapolateLeft:'clamp' AND extrapolateRight:'clamp'. Use useCurrentFrame() directly — NEVER subtract scene start. Stagger by 6+ frames. overflow:'hidden' on root.`,
    `</critical_reminder>`,
  ];

  return sections.join('\n');
}
