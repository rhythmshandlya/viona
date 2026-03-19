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

### Liquid Glass — MANDATORY
Every container, card, or panel in this scene uses the liquid glass treatment. This is not optional. A scene with flat-colored rectangles or static styled divs is a failure. The glass treatment applies to every surface that holds content:
- **Animated gradient surface** — \`linear-gradient\` with angle shifting over time via \`Math.sin(frame * 0.02)\`
- **Specular highlight sweep** — bright gradient overlay translating across the panel
- **Depth shadow** — animates in with the panel (0 → full over 15 frames)
- **Glass shimmer** — at least one continuously oscillating property (opacity, highlight position, or gradient shift)

A glass surface with a static \`background: 'rgba(...)'\` and no animated properties is NOT liquid glass — it is a flat rectangle.

### Layout Composition
Follow the layout pattern from the plan (center-dominant, asymmetric, diagonal, stacked, full-bleed, or scattered). Do not default to top/middle/bottom zones. Place elements according to the specified pattern. Leave bottom 12% clear for captions, but otherwise use the full canvas creatively.

### Text Placement
- Text must have \`textShadow\` or a contrasting backdrop for readability
- Text opacity 1.0 at rest — no dimming

### Z-Ordering & Overflow
- Use \`overflow: 'hidden'\` on the root container
- Layer decorative elements behind content (lower z-index)

### Backgrounds
- Background is NEVER static — at least one of: gradient angle shift, mesh gradient movement, slow color rotation
- Avoid flat solid colors — always use an animated gradient or layered mesh
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
- Glass cards must use animated liquid glass (animated gradient + at least one of: specular sweep, shimmer, or depth shadow animation). Static \`GLASS.background\` alone is not enough — every glass surface needs at least one continuously animating property.

### Motion
- Entrance directions must vary — not everything from the same direction
- Opacity and transform offsets: stagger by 3-5 frames (never start on same frame)
- Every settled element needs idle motion (float, breathe, or glow pulse)
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
- Use \`spring()\` for entrances/exits. Select from SPRINGS vocabulary (SNAPPY, SMOOTH, BOUNCY, HEAVY) — adjacent elements should use different springs.
- Stagger elements by 6+ frames minimum. NEVER animate all at once.
- Entrance directions MUST vary within a scene — not everything from bottom. Mix: translateY, translateX, scale, rotation.
- Opacity and transform must NOT start on the same frame — offset by 3-5 frames for physical weight.
- Every settled element needs idle motion (float, breathe, rotate drift, or glow pulse). Nothing frozen >45 frames.
- Root container: \`overflow: 'hidden'\`.
- All sizes relative to effective width/height (EW/EH). No hardcoded pixels.
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
