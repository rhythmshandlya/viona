# Video Aesthetics Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 aesthetic issues in pipeline output — liquid glass only in overlays, black bars on 9:16, missing zoom cuts, static animations — via prompt-layer changes only.

**Architecture:** All changes target prompt files (markdown) and one code file (`manifest-ops.ts`). The Animator prompt is assembled programmatically in `prompt-assembly.ts` from `layoutRules()`, `overlayRules()`, `CODING_RULES`, and dynamically loaded `studio-theme.md`. Other agents (Layout Editor, Trim Editor, Planner) use static markdown prompts.

**Tech Stack:** Markdown prompt files, TypeScript (one-line change in manifest-ops.ts)

**Spec:** `docs/superpowers/specs/2026-03-19-video-aesthetics-overhaul-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/sandbox/src/tools/manifest-ops.ts` | Modify line 197 | Expose `videoSettings` in `read_manifest` summary |
| `packages/sandbox/template/docs/guidelines/studio-theme.md` | Rewrite | Liquid glass recipe, spring vocabulary, content-adaptive color, typography, updated examples |
| `packages/sandbox/src/prompt-assembly.ts` | Modify | Update `layoutRules()`, `overlayRules()`, `CODING_RULES` — glass mandate, motion rules, layout guidance |
| `packages/sandbox/src/prompts/layout-editor/system.md` | Modify | Add Step 0 (zoom-to-fill), enforce splits, enforce punch-ins |
| `packages/sandbox/src/prompts/layout-editor/reminder.md` | Modify | Add zoom/split/punch-in reminders |
| `packages/sandbox/src/prompts/trim-editor/system.md` | Modify | Replace vague jump-cut coverage with specific crop values |
| `packages/sandbox/src/prompts/planner/system.md` | Modify | Add `layout` field to scene schema, layout pattern variety |
| `packages/sandbox/template/docs/guidelines/editing-style.md` | Modify | Add layout patterns section |
| `packages/sandbox/template/.claude/CLAUDE.md` | Modify | Add glass/motion rules and video positioning section |

---

### Task 1: Expose videoSettings in read_manifest

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts:191-198`

The Layout Editor needs `sourceWidth`/`sourceHeight` from `manifest.videoSettings` for zoom-to-fill calculation, but the `read_manifest` summary doesn't include it.

- [ ] **Step 1: Add videoSettings to the summary response**

In `packages/sandbox/src/tools/manifest-ops.ts`, find the summary response object (line 191-198). Add `videoSettings`:

```typescript
        return JSON.stringify({
          durationMs: manifest.durationMs,
          canvas: manifest.canvas,
          tracks: trackSummaries,
          totalItems: (manifest.items ?? []).length,
          assetKeys: Object.keys(manifest.assets ?? {}),
          captionStyle: manifest.captionStyle ?? null,
          videoSettings: manifest.videoSettings ?? null,
        });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: Clean compilation (no errors)

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "fix(sandbox): expose videoSettings in read_manifest summary

Layout Editor Step 0 needs sourceWidth/sourceHeight for zoom-to-fill."
```

---

### Task 2: Rewrite studio-theme.md

**Files:**
- Modify: `packages/sandbox/template/docs/guidelines/studio-theme.md`

This is the largest single change. The file is loaded dynamically by `loadThemeContent()` in `prompt-assembly.ts` and injected into every Animator prompt. Changes: replace static GLASS recipe with animated liquid glass, replace single SPRING_CONFIG with vocabulary of 4 springs, update typography (allow 700-800 weight for hero text), add content-adaptive color section, update examples.

- [ ] **Step 1: Replace Glass Effect Recipe section**

Find the "### Glass Effect Recipe" section (lines 47-75). Replace with Remotion-compatible liquid glass:

```markdown
### Liquid Glass Effect (Remotion-Compatible)

Remotion renders via canvas screenshots — `backdrop-filter` is unreliable. Use these layered techniques instead. **Every glass surface must have at least one continuously animating property.**

**Glass Surface — Animated Gradient:**
```tsx
// Base glass panel — gradient angle shifts over time
background: `linear-gradient(
  ${135 + Math.sin(frame * 0.02) * 10}deg,
  rgba(28, 28, 35, 0.65),
  rgba(45, 40, 60, 0.45)
)`;
border: '1px solid rgba(255, 255, 255, 0.08)',
borderTop: '1px solid rgba(255, 255, 255, 0.12)',
borderRadius: 20,
```

**Specular Highlight Sweep:**
```tsx
// Bright streak translates across the panel over 40-60 frames
<div style={{
  position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden',
  pointerEvents: 'none',
}}>
  <div style={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
    transform: `translateX(${interpolate(frame, [enterFrame, enterFrame + 50], [-100, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%)`,
  }} />
</div>
```

**Depth Shadows — Animate In:**
```tsx
// Shadow fades in with the panel (0 → full over 15 frames)
const shadowOpacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
});
boxShadow: `0 8px 24px rgba(0,0,0,${0.4 * shadowOpacity}),
            inset 0 1px 0 rgba(255,255,255,${0.1 * shadowOpacity})`
```

**Grain Texture (optional, adds tactile quality):**
```tsx
// Subtle noise overlay that shifts every 3-4 frames
backgroundPosition: `${Math.floor(frame / 3) * 50}px ${Math.floor(frame / 3) * 30}px`
// Apply at 5-8% opacity on a dedicated noise overlay div
```

**Glass Shimmer — Continuous:**
```tsx
// At least one property must oscillate continuously
const shimmer = 0.06 + Math.sin(frame * 0.04) * 0.03;
// Apply to a highlight overlay element's opacity
```

**Key rule:** A glass surface with a static `background: 'rgba(...)'` and no animated properties is NOT liquid glass. It's a flat rectangle. Every glass card needs the animated gradient + at least one of: specular sweep, shimmer, grain, or depth shadow animation.

**GLASS constant (for reference — animators should animate these, not use statically):**
```typescript
const GLASS = {
  background: 'rgba(28, 28, 35, 0.55)',    // Use as animated gradient base
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  shadow: '0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};
```
```

- [ ] **Step 2: Replace Typography Weight & Emphasis section**

Find "### Weight & Emphasis" (line 111-116). Replace:

```markdown
### Weight & Emphasis
- **Hero text** (main numbers, key phrases, titles): weight **700-800**. Bold text stops the scroll.
- **Heading weight:** 500
- **Body weight:** 400
- **Label weight:** 400
- Letter spacing: `0.025em` standard, `-0.025em` for tight headings
- The weight differential (700+ vs 400) creates hierarchy that reads at scroll speed on a phone screen.
```

- [ ] **Step 3: Replace Spring Configuration section**

Find "### Spring Configuration" (lines 120-128). Replace with vocabulary:

```markdown
### Spring Vocabulary

Replace the single universal spring with semantic-purpose springs. Select based on what the element IS, not random choice.

```typescript
const SPRINGS = {
  SNAPPY:  { damping: 20, mass: 1, stiffness: 180 },   // Hero reveals, key numbers, emphasis
  SMOOTH:  { damping: 28, mass: 1, stiffness: 120 },   // Cards, containers, supporting elements
  BOUNCY:  { damping: 12, mass: 0.8, stiffness: 200 }, // Icons, small accents, playful moments
  HEAVY:   { damping: 35, mass: 1.5, stiffness: 100 }, // Large panels, backgrounds, weighty arrivals
};
```

**Rule:** Adjacent elements SHOULD use different springs. A hero number enters SNAPPY while its label enters SMOOTH. A card enters HEAVY while its icon enters BOUNCY. Spring contrast creates choreography. Same spring on adjacent elements is acceptable if semantically justified, but never the default.
```

- [ ] **Step 4: Replace Motion Principles section**

Find "### Motion Principles" (lines 149-170). Replace entirely:

```markdown
### Motion Principles

**Entrance Directions — must vary within a scene:**
- **From bottom** (translateY +30 → 0) — default, primary content
- **From left/right** (translateX ±40 → 0) — side-by-side elements, comparisons
- **Scale up** (scale 0.85 → 1.0) — hero moments, emphasis
- **Scale down** (scale 1.15 → 1.0) — "arriving from above" feeling
- **Rotation** (rotate ±5deg → 0) — sparingly, accent elements only

**Never have all elements in a scene enter from the same direction.** If the title comes from bottom, the supporting card should scale up or come from the side.

**Overlapping Action — offset opacity and transform:**
- Opacity starts 3-5 frames BEFORE position/scale
- OR position starts 3-5 frames BEFORE opacity
- Simultaneous opacity + transform is the #1 tell of amateur animation. The offset creates physical weight.

**Mandatory Continuous Motion — every settled element gets idle motion:**
- **Float:** `translateY(Math.sin(frame * 0.03) * 3)` — gentle vertical drift
- **Breathe:** `scale(1 + Math.sin(frame * 0.04) * 0.015)` — subtle pulse
- **Rotate drift:** `rotate(Math.sin(frame * 0.02) * 1.5)` — barely perceptible tilt
- **Glow pulse:** opacity oscillation on a shadow or highlight element

**Background is NEVER static.** At least one of: gradient position shift, dot grid drift, slow color rotation, mesh gradient movement.

A scene where anything is frozen for more than 45 frames (~1.5 seconds at 30fps) needs attention — check if idle motion was missed.

**Exits:**
- Fade out (`opacity: 1 → 0`) with slight downward drift
- Use `ease-out` easing, NOT spring
- Faster than entrances (12 frames vs 20 frames)

**Scene Choreography — follow audio energy:**
- On emphasis words → trigger hero element entrance (SNAPPY spring)
- On pauses → let elements breathe, ambient motion only
- On lists/enumeration → stagger elements at 8-12 frame intervals, each from a different direction
- On conclusion/summary → elements settle, subtle zoom-out (scale 1.0 → 0.98 over 30 frames)

**No dead air:** If there are more than 20 frames where nothing is entering or transforming (only idle), add a secondary element: accent line drawing, number ticking, highlight sweep.
```

- [ ] **Step 5: Add Content-Adaptive Color section**

After the Color Palette section (after line 45), add:

```markdown
### Content-Adaptive Color

Color direction comes from the scene content, not a fixed palette. Read the scene's description from the plan:
- Growth/money/success → emerald/gold tones (`#10b981`, `#f59e0b`)
- Danger/urgency/warning → warm red/amber (`#ef4444`, `#f97316`)
- Technical/data/analysis → cool blue/cyan (`#3b82f6`, `#06b6d4`)
- Creative/inspiration → violet/magenta (`#8b5cf6`, `#ec4899`)
- Calm/health/nature → teal/green (`#14b8a6`, `#22c55e`)

The violet accent (`#8B5CF6`) is ONE option, not the default. Each scene should feel like it belongs to the video's topic. The background base can shift too — deep navy (`#0a0a1a`), dark warm gray (`#1a1412`), or deep emerald (`#0a1a12`) instead of always `#08080C`.

**Implementation:** `constants.ts` defines `COLORS.primary` as a single value (written by Setup Agent). Animators use inline hex colors per scene rather than relying on `COLORS.primary` for accent color. `COLORS.primary` remains as a fallback.
```

- [ ] **Step 6: Update the Do NOT Use section**

Find the "## Do NOT Use" section (line 495-503). Remove the "Font weight above 500" bullet. Update to:

```markdown
## Do NOT Use
- Pure black (`#000000`) or pure white (`#FFFFFF`) — always off-black and off-white
- Hard borders (1px solid white) — all borders are low-opacity white
- Bright saturated backgrounds — backgrounds are always dark with subtle tints
- Drop shadows with color (colored shadows) — shadows are always neutral black at varying opacity
- Gradients on text
- 3D transforms (rotateX, rotateY, perspective) — keep everything flat/2D
- Static flat-colored rectangles as containers — every surface must use liquid glass treatment
- `backdrop-filter` — unreliable in Remotion canvas rendering. Use animated gradients instead.
```

- [ ] **Step 7: Update Example Scenes**

The three example scenes (lines 248-493) use old patterns: `SPRING_CONFIG`, `fontWeight: 500`, static backgrounds, no idle motion. Replace Example 1 with a liquid glass version demonstrating the new patterns. Keep Examples 2 and 3 but update `fontWeight` on hero text to 700, replace `SPRING_CONFIG` references with `SPRINGS.SNAPPY`/`SPRINGS.SMOOTH`, and add idle motion comment hints.

Example 1 replacement:

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

const SPRINGS = {
  SNAPPY: { damping: 20, mass: 1, stiffness: 180 },
  SMOOTH: { damping: 28, mass: 1, stiffness: 120 },
  HEAVY: { damping: 35, mass: 1.5, stiffness: 100 },
};

const ThreeStepProcess: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const steps = ['Research', 'Design', 'Build'];

  // Animated background gradient
  const bgAngle = 135 + Math.sin(frame * 0.015) * 8;

  return (
    <div style={{
      width, height, overflow: 'hidden',
      background: `linear-gradient(${bgAngle}deg, #08080C, #12101a)`,
    }}>
      {/* Title — enters with SNAPPY spring, scale up */}
      {(() => {
        const titleProgress = spring({ frame, fps, config: SPRINGS.SNAPPY, delay: 0 });
        const titleScale = interpolate(titleProgress, [0, 1], [0.85, 1]);
        // Opacity leads transform by 4 frames
        const titleOpacity = interpolate(frame, [0, 10], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        // Idle: gentle breathe after entrance
        const idleBreathe = frame > 20 ? 1 + Math.sin(frame * 0.04) * 0.008 : 1;
        return (
          <h1 style={{
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: 56, fontFamily: 'Sora', fontWeight: 700,
            textAlign: 'center', marginTop: height * 0.2,
            opacity: titleOpacity,
            transform: `scale(${titleScale * idleBreathe})`,
          }}>
            The Process
          </h1>
        );
      })()}

      {/* Step cards — staggered, different springs, different entrance directions */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 40 }}>
        {steps.map((step, i) => {
          const delay = 8 + i * 10;
          // Cards use SMOOTH spring, enter from bottom
          const cardProgress = spring({ frame, fps, config: SPRINGS.SMOOTH, delay });
          const cardY = interpolate(cardProgress, [0, 1], [30, 0]);
          // Opacity leads transform by 3 frames
          const cardOpacity = interpolate(frame, [delay - 3, delay + 12], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          // Glass gradient angle shifts per card
          const glassAngle = 135 + Math.sin((frame + i * 20) * 0.02) * 10;
          // Idle float after settling
          const idleFloat = cardProgress >= 0.95 ? Math.sin((frame + i * 15) * 0.03) * 2 : 0;

          return (
            <div key={step} style={{
              position: 'relative',
              background: `linear-gradient(${glassAngle}deg, rgba(28, 28, 35, 0.65), rgba(45, 40, 60, 0.45))`,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              boxShadow: `0 8px 24px rgba(0,0,0,${0.4 * cardOpacity}), inset 0 1px 0 rgba(255,255,255,${0.06 * cardOpacity})`,
              padding: 32, width: 280, textAlign: 'center',
              opacity: cardOpacity,
              transform: `translateY(${cardY + idleFloat}px)`,
              overflow: 'hidden',
            }}>
              {/* Specular highlight sweep */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 20,
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                transform: `translateX(${interpolate(frame, [delay, delay + 50], [-100, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ color: '#8B5CF6', fontSize: 40, fontWeight: 700, position: 'relative' }}>
                {i + 1}
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: 32, marginTop: 12, position: 'relative' }}>
                {step}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThreeStepProcess;
```

- [ ] **Step 8: Update footer note**

Replace the final italic note (line 507) with:

```markdown
*This is Viona's default studio theme. Every animator agent loads this before generating scene code. All `COLORS`, `SPRINGS`, `FONTS`, `SPACING` constants in the workspace `constants.ts` must match these values. Liquid glass is mandatory on every surface — no static flat rectangles.*
```

- [ ] **Step 9: Commit**

```bash
git add packages/sandbox/template/docs/guidelines/studio-theme.md
git commit -m "feat(sandbox): rewrite studio-theme.md for liquid glass and dynamic motion

Replace static GLASS recipe with Remotion-compatible liquid glass (animated
gradients, specular highlights, depth shadows, shimmer). Replace single
SPRING_CONFIG with 4-spring vocabulary. Add content-adaptive color guidance.
Allow font weight 700-800 for hero text. Add overlapping action and
continuous idle motion rules. Update examples to demonstrate new patterns."
```

---

### Task 3: Update prompt-assembly.ts

**Files:**
- Modify: `packages/sandbox/src/prompt-assembly.ts:32-63` (`layoutRules()`), `162-177` (`CODING_RULES`)

- [ ] **Step 1: Update layoutRules() — add glass mandate and layout guidance**

In `layoutRules()` (line 32), replace the function body. The key additions are: glass mandate for fullscreen scenes, creative layout guidance (no rigid zones), and a note about varied entrance directions. The existing split-screen addendum stays.

```typescript
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
```

- [ ] **Step 2: Update overlayRules() — reinforce animated glass for overlays**

In `overlayRules()` (line 67), find the Motion section (lines 90-94). Replace the entire `### Motion` section AND modify the glass card bullet in `### Content`:

Replace line 88 (`- Glass card backgrounds must be semi-transparent (see GLASS constants)`) with:
```
- Glass cards must use animated liquid glass (animated gradient + at least one of: specular sweep, shimmer, or depth shadow animation). Static \`GLASS.background\` alone is not enough — every glass surface needs at least one continuously animating property.
```

Replace the `### Motion` section (lines 90-94) with:
```
### Motion
- Entrance directions must vary — not everything from the same direction
- Opacity and transform offsets: stagger by 3-5 frames (never start on same frame)
- Every settled element needs idle motion (float, breathe, or glow pulse)
- Keep animations subtle — overlays should enhance, not distract
```

- [ ] **Step 3: Update CODING_RULES — spring vocabulary and entrance variety**

Find `CODING_RULES` constant (line 162). Replace:

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: Clean compilation

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompt-assembly.ts
git commit -m "feat(sandbox): add glass mandate, spring variety, and motion rules to animator prompt

Update layoutRules() with liquid glass mandate for all surfaces, creative
layout guidance, and never-static backgrounds. Update overlayRules() to
require animated glass on overlay scenes. Update CODING_RULES with spring
vocabulary selection, varied entrance directions, overlapping action
offset, and mandatory idle motion."
```

---

### Task 4: Update Layout Editor prompts

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`
- Modify: `packages/sandbox/src/prompts/layout-editor/reminder.md`

- [ ] **Step 1: Add Step 0 (zoom-to-fill) to system.md**

Insert a new Step 0 before the existing "### Step 1: Read inputs". Add it right after the `## Core Rules` section ends and before `## Process (exact order)`. The new step goes between the `## Process` heading and the existing Step 1.

Find `### Step 1: Read inputs` (line 23). Insert BEFORE it:

```markdown
### Step 0: Zoom-to-Fill Video
Before any scene work, position the source video to fill the 9:16 canvas with zero black bars.

1. Read the manifest (`read_manifest`) — note `canvas` (width/height) and `videoSettings` (sourceWidth/sourceHeight).
2. Calculate the zoom-to-fill scale: `zoomFillScale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight)` — for 16:9 source on 9:16 canvas, this is ~1.78.
3. For each video item on the video track, apply `update_item` with `data.crop`:
   - If the item has NO existing crop: `{ x: 50, y: 50, scale: zoomFillScale }`
   - If the item already has a crop (from Trim Editor): multiply scales, preserve offset: `{ x: existingCrop.x, y: existingCrop.y, scale: existingCrop.scale * zoomFillScale }`
4. If `speaker-grid.json` exists, shift the crop y-center toward the speaker's face zone (e.g., y: 45 instead of 50 to bias toward the head).
5. **Render a still** via `render_still` at frame 10 and verify zero black bars. If black bars remain, increase the scale by 5% and re-render.

**Crop coordinate system:**
- `x, y`: center-point percentages (0-100). `x=50, y=50` = center of video.
- `scale`: zoom factor. `scale=1` = no zoom. `scale=1.78` = 178% zoom (fills 9:16 from 16:9).
- The video is wrapped in `overflow: hidden`, so zooming past the edges is cropped.

**Edge case:** If source aspect ratio already matches canvas (both 9:16), skip this step (no crop needed).

```

- [ ] **Step 2: Add enforcement language to Steps 3-5**

Find "### Step 3: Split video AND audio at scene boundaries" (line 29). Add after the existing text:

```markdown
**ENFORCEMENT: You MUST use split_item. Using keyframes on unsplit items to simulate scene boundaries is WRONG and will produce broken output. Each scene boundary requires a physical split_item call on both the video AND its paired audio item.**

**Self-check after splits:** Read the manifest and count video items. You should have N video items (one per scene + one per gap between scenes). If you still have the original number of items, you skipped splits — go back and execute them.
```

Find "### Step 4: Split video at punch-in points" (line 32). Add after:

```markdown
**ENFORCEMENT: If SCENE_PLAN.md contains a Punch-in Locations table, you MUST execute every entry. Skipping is not acceptable.**
```

Find "### Step 5: Split video at multi-angle cut points" (line 35). Add after:

```markdown
**ENFORCEMENT: If SCENE_PLAN.md contains a Multi-angle Cuts table, you MUST execute every entry.**

**After executing punch-ins and multi-angle cuts:** Read the manifest and verify that crop values are set on the correct video items. If any planned crop is missing, go back and apply it.
```

- [ ] **Step 3: Update reminder.md**

Append to the end of `packages/sandbox/src/prompts/layout-editor/reminder.md`:

```markdown
- Step 0: zoom-to-fill MUST be done first. No black bars on 9:16 canvas.
- Splits are MANDATORY. Keyframes on unsplit items = wrong. Each scene boundary = split_item on BOTH video AND audio.
- Every punch-in in the plan MUST be executed. Every multi-angle cut MUST be executed.
- After splits, read the manifest and count video items — verify the count matches your expected number.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/layout-editor/reminder.md
git commit -m "feat(sandbox): add zoom-to-fill Step 0 and enforce splits/punch-ins in Layout Editor

New Step 0 calculates zoom-to-fill crop from sourceWidth/sourceHeight,
composes with existing Trim Editor crops, verifies via render_still.
Add enforcement language and self-checks for splits and punch-ins."
```

---

### Task 5: Update Trim Editor prompt

**Files:**
- Modify: `packages/sandbox/src/prompts/trim-editor/system.md:27`

- [ ] **Step 1: Replace jump-cut coverage instruction**

Find the line (line 27):
```
- **Jump cut coverage:** After trimming, every visible edit point needs coverage. Add 3-8% zoom punch-in at each cut point using split_item + crop transform.
```

Replace with:

```markdown
- **Jump cut coverage:** After trimming, every visible edit point needs visual coverage. On alternating video segments, apply a subtle relative crop — `{ x: 50, y: 48, scale: 1.06 }` on odd segments (slight zoom + pan up) vs no crop on even segments. Use `update_item` on `data.crop`. This creates visual variety at cuts. The Layout Editor (Phase 5) will later multiply these by its zoom-to-fill factor, preserving the alternating pattern.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/trim-editor/system.md
git commit -m "feat(sandbox): add specific jump-cut coverage crop values to Trim Editor

Replace vague 3-8% zoom instruction with exact alternating crop pattern
({ x: 50, y: 48, scale: 1.06 } on odd segments). Notes that Layout Editor
Phase 5 will multiply these by zoom-to-fill factor."
```

---

### Task 6: Update Planner prompt and editing-style.md

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`
- Modify: `packages/sandbox/template/docs/guidelines/editing-style.md`

- [ ] **Step 1: Add layout field to Planner scene schema**

In `packages/sandbox/src/prompts/planner/system.md`, find the per-scene entry schema (around line 26-52). After the `**Energy:** 1-5` line, add:

```markdown
**Layout:** center-dominant | asymmetric | diagonal-flow | stacked-cascade | full-bleed | scattered
```

- [ ] **Step 2: Add layout variety rule to Planner**

Find the "## Energy Arc" section (line 155). Add BEFORE it:

```markdown
## Layout Pattern Variety

No two adjacent scenes should use the same layout pattern. Available patterns:
- **center-dominant** — hero element large and centered, supporting text wraps around
- **asymmetric** — content weighted 60/40 or 70/30 to one side, creates visual tension
- **diagonal-flow** — elements along a diagonal axis, top-left to bottom-right
- **stacked-cascade** — elements overlap slightly with parallax depth, front-to-back
- **full-bleed** — single element fills entire canvas (large typography, one data point)
- **scattered** — elements placed organically, not grid-aligned, dynamic and less corporate

Specify a `layout` field per scene in SCENE_PLAN.md. The Animator follows it.
```

- [ ] **Step 3: Update self-verification table**

Find the self-verification table item (line 179). Add to the list of checks: `layout patterns vary (no adjacent duplicates)`.

- [ ] **Step 4: Add layout patterns to editing-style.md**

In `packages/sandbox/template/docs/guidelines/editing-style.md`, find the "## Scene Design Rules" section (line 144). Add before it:

```markdown
## Layout Pattern Variety

No two adjacent scenes should use the same composition pattern:
- **Center-dominant** — hero element large and centered, supporting text wraps around
- **Asymmetric** — content weighted 60/40 or 70/30 to one side
- **Diagonal flow** — elements along a diagonal axis, top-left to bottom-right
- **Stacked cascade** — elements overlap slightly with parallax depth
- **Full-bleed** — single element fills entire canvas
- **Scattered** — elements placed organically, not grid-aligned

The Planner specifies a `layout` field per scene. The Animator follows the specified pattern rather than defaulting to top/middle/bottom zones. Bottom 12% stays clear for captions.
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md packages/sandbox/template/docs/guidelines/editing-style.md
git commit -m "feat(sandbox): add layout pattern variety to Planner and editing style

Add layout field to scene schema (center-dominant, asymmetric, diagonal,
stacked, full-bleed, scattered). No two adjacent scenes same pattern.
Add variety guidance to editing-style.md."
```

---

### Task 7: Update workspace CLAUDE.md

**Files:**
- Modify: `packages/sandbox/template/.claude/CLAUDE.md`

- [ ] **Step 1: Add Glass & Motion Rules and Video Positioning sections**

Append to the end of `packages/sandbox/template/.claude/CLAUDE.md`:

```markdown

## Glass & Motion Rules
- Every container/card/panel uses animated liquid glass (gradient surface + specular highlight + depth shadow + grain). Static flat rectangles are wrong.
- Spring vocabulary: SNAPPY (hero), SMOOTH (cards), BOUNCY (accents), HEAVY (panels). Adjacent elements should use different springs.
- Entrance directions must vary within a scene — not everything from bottom.
- Every settled element needs idle motion (float, breathe, rotate drift, or glow pulse).
- Background is never static — at least one continuously animating property.
- Opacity and transform offsets: stagger by 3-5 frames (never start on same frame).

## Video Positioning
- Layout Editor Step 0: zoom-to-fill eliminates black bars on 9:16 canvas from landscape sources.
- If source video has a crop from Trim Editor, Layout Editor multiplies by zoom-fill factor (preserves relative offsets).
```

- [ ] **Step 2: Update Import Pattern to reference SPRINGS**

Find the Import Pattern section. Update the example:

```markdown
## Import Pattern
```tsx
import { COLORS, SPRINGS } from '../constants';
import { Background } from '../components/Background';
```
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/.claude/CLAUDE.md
git commit -m "feat(sandbox): add glass/motion rules and video positioning to workspace CLAUDE.md

Add liquid glass mandate, spring vocabulary reference, entrance direction
variety, idle motion rules, overlapping action offset, and zoom-to-fill
note for Layout Editor."
```

---

### Task 8: Final verification

- [ ] **Step 1: Compile sandbox package**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: Clean compilation (only manifest-ops.ts and prompt-assembly.ts are compilable; rest are markdown)

- [ ] **Step 2: Review all changed files**

Run: `git diff --stat HEAD~7` (count of commits from tasks 1-7)
Verify all 9 files from the spec's Files Changed table are present.

- [ ] **Step 3: Final commit (if any fixups needed)**

If any issues found during review, fix and commit.
