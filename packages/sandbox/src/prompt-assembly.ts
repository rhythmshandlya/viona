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
  canvasWidth: number;         // full canvas width (for reference)
  canvasHeight: number;        // full canvas height (for reference)
  sceneWidth: number;          // actual scene render width
  sceneHeight: number;         // actual scene render height
  fps: number;
  theme: string;
  displayMode: 'fullscreen' | 'split-screen' | 'overlay';
}

// ---- Layout rules ----

function layoutRules(config: SceneConfig): string {
  return `
## LAYOUT & SPATIAL RULES

Your scene renders at ${config.sceneWidth}×${config.sceneHeight}. All sizes must be relative to these dimensions.

### Motion & Direction
- Animate entrance from a consistent direction (e.g., left-to-right for new content)
- Exit animations should reverse the entrance direction
- Stagger entrances by at least 4 frames to avoid simultaneous pops

### Text Placement
- Bottom ~15% of the scene should be kept clear for potential captions
- Text must have \`textShadow\` or a contrasting backdrop for readability
- Text opacity 1.0 at rest — no dimming

### Z-Ordering & Overflow
- Use \`overflow: 'hidden'\` on the root container
- Layer decorative elements behind content (lower z-index)
- Max 2-3 elements visible at any moment — avoid clutter

### Backgrounds
- Prefer animated backgrounds — gradients, patterns, or subtle motion
- Avoid flat solid colors unless the scene brief explicitly calls for them
${config.displayMode === 'split-screen' ? `
### Split-Screen Considerations
- Your scene shares the screen with the speaker video below — keep backgrounds subtle so they don't compete
- Content near the bottom edge of your scene area should have extra padding (the split boundary)
- The viewer's attention is divided — make key elements bold and readable at a glance
` : ''}`;

}

// ---- Overlay rules ----

function overlayRules(config: SceneConfig): string {
  return `
## OVERLAY SCENE RULES

This scene will be composited ON TOP of the speaker video. It MUST have a transparent background.

### Transparent Background
- Do NOT use the <Background> component
- Do NOT set any background color on the root container
- The root container must be transparent — no fill, no gradient
- Use glass cards (from GLASS constants) for individual elements — those have their own semi-transparent backgrounds

### Sizing
- Your scene renders at exactly ${config.sceneWidth}×${config.sceneHeight} — design for this size
- The manifest transform will place your scene at the correct position on the canvas
- All element sizes should be relative to your scene dimensions (${config.sceneWidth}×${config.sceneHeight}), not the full canvas (${config.canvasWidth}×${config.canvasHeight})

### Content
- Keep it focused — overlays supplement the speaker, they don't compete
- Maximum 3-4 visible elements at once
- Ensure all text is readable at the scene's actual render size
- Glass card backgrounds must be semi-transparent (see GLASS constants)

### Motion
- Entrance from a consistent direction (slide in from left/right/bottom)
- Exit should reverse the entrance direction
- Keep animations subtle — overlays should enhance, not distract
`;
}

// ---- Theme loading ----

async function loadThemeContent(theme: string): Promise<string> {
  const paths = [
    // New guideline path (preferred)
    join(WORKSPACE, 'docs', 'guidelines', 'studio-theme.md'),
    // Legacy paths (fallback)
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
- **Display mode:** ${config.displayMode}
- **Render size:** ${config.sceneWidth}×${config.sceneHeight}
- **Duration:** ${config.durationFrames} frames (${(config.durationFrames / config.fps).toFixed(1)}s)

### Visual Brief

${config.sceneBrief}

### Sync Points

${syncPointsText}

### Important

- Write ONLY the file \`scenes/${config.sceneFile}.tsx\`
${config.displayMode === 'overlay'
    ? '- Import from `../constants` (already exists)\n- Do NOT use Background component — this is an overlay scene (transparent background)'
    : '- Import from `../constants` and `../components/Background` (already exist)'}
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
  const isOverlay = config.displayMode === 'overlay';

  // Assemble the prompt — this is the ONLY prompt source for the Animator.
  // No separate system.md. Skills are injected via SDK skills field.
  const sections = [
    `<role>You are a motion graphics engineer. Write one Remotion .tsx scene file based on the brief below. You decide HOW to animate — techniques, spring physics, choreography.</role>`,
    '',
    `Canvas: ${config.canvasWidth}×${config.canvasHeight} @ ${config.fps}fps`,
    `Scene render size: ${config.sceneWidth}×${config.sceneHeight}`,
    `Display mode: ${config.displayMode}`,
    '',
    CODING_RULES,
    '',
    themeContent,
    '',
    isOverlay ? overlayRules(config) : layoutRules(config),
    '',
    formatSceneBrief(config),
    '',
    SELF_HEALING_RULES,
    '',
    `<critical_reminder>`,
    `EVERY interpolate() needs extrapolateLeft:'clamp' AND extrapolateRight:'clamp'. Use useCurrentFrame() directly — NEVER subtract scene start. Stagger by 6+ frames. overflow:'hidden' on root.`,
    isOverlay
      ? `This is an OVERLAY scene. Background MUST be transparent (no Background component, no background color). Size content to ${config.sceneWidth}×${config.sceneHeight}.`
      : '',
    `</critical_reminder>`,
  ];

  return sections.join('\n');
}
