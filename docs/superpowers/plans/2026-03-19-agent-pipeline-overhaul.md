# Agent Pipeline Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-agent sequential pipeline (Trim Editor → Planner → Visual Editor → Animator → QC Reviewer) with a 7-agent pipeline (Trim Editor → Planner → Setup Agent → Layout Editor → Animators (parallel) → Final Editor) orchestrated by a proactive Viona.

**Architecture:** The orchestrator (Viona) dispatches specialized subagents via the Claude Agent SDK `Agent` tool. Each subagent gets a system prompt assembled from shared modules + agent-specific prompt + examples + reminder (sandwich pattern). The key changes are: (1) split Visual Editor into Layout Editor + Final Editor, (2) add Setup Agent, (3) remove QC Reviewer (Viona reviews), (4) new per-scene plan schema, (5) guideline files wired into prompts.

**Tech Stack:** TypeScript, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Remotion, MCP servers

**Spec:** `docs/superpowers/specs/2026-03-19-agent-overhaul-design.md`

**Reference docs:**
- `docs/agent-overhaul/01-targets.md` — video quality targets
- `docs/agent-overhaul/styles/motion-graphics-focused.md` — editing style guide
- `docs/agent-overhaul/themes/viona-glass.md` — studio theme

---

## File Structure

### New Files
```
packages/sandbox/template/docs/guidelines/
  editing-style.md                    — Editing style guide (from motion-graphics-focused.md)
  studio-theme.md                     — Studio theme (from viona-glass.md)

packages/sandbox/src/prompts/
  setup-agent/
    system.md                         — Setup Agent system prompt
    reminder.md                       — Critical reminder (sandwich)
  layout-editor/
    system.md                         — Layout Editor system prompt
    reminder.md                       — Critical reminder
    examples/good-layout.md           — Example layout operations
  final-editor/
    system.md                         — Final Editor system prompt
    reminder.md                       — Critical reminder
```

### Modified Files
```
packages/sandbox/src/prompts/
  shared/identity.xml                 — Add guideline file paths to workspace layout
  orchestrator/system.md              — Rewrite: new pipeline flow, proactive behavior, 7 agents
  planner/system.md                   — Rewrite: per-scene entry schema, editing style input
  planner/reminder.md                 — Update for new schema requirements
  planner/examples/good-plan.md       — Update with new schema format
  trim-editor/system.md               — Minor: add prerequisite section

packages/sandbox/src/
  orchestrator.ts                     — Replace 5 agents with 7, update tool lists, labels
  prompt-assembly.ts                  — Add overlay scene support (displayMode, sceneWidth/Height)
```

### Deleted Files
```
packages/sandbox/src/prompts/
  visual-editor/                      — Entire directory (replaced by layout-editor + final-editor)
  qc-reviewer/                        — Entire directory (Viona does review)
```

---

## Task 1: Workspace Template — Guideline Files

Add the two hardcoded guideline files to the workspace template so they're available at `/workspace/docs/guidelines/` for all agents to read.

**Files:**
- Create: `packages/sandbox/template/docs/guidelines/editing-style.md`
- Create: `packages/sandbox/template/docs/guidelines/studio-theme.md`
- Modify: `packages/sandbox/src/prompts/shared/identity.xml`

- [ ] **Step 1: Create guidelines directory in template**

```bash
mkdir -p packages/sandbox/template/docs/guidelines
```

- [ ] **Step 2: Copy editing style to template**

Copy the content of `docs/agent-overhaul/styles/motion-graphics-focused.md` to `packages/sandbox/template/docs/guidelines/editing-style.md`.

This file tells the Planner which techniques to use and when. It must be copied exactly — no modifications. The file is approximately 229 lines covering 9 techniques, pacing rules, display mode decision tree, and scene content strategy.

- [ ] **Step 3: Copy studio theme to template**

Copy the content of `docs/agent-overhaul/themes/viona-glass.md` to `packages/sandbox/template/docs/guidelines/studio-theme.md`.

This file tells the Setup Agent and Animators the visual DNA. Copy exactly — no modifications.

- [ ] **Step 4: Update identity.xml with guideline paths**

In `packages/sandbox/src/prompts/shared/identity.xml`, add the guideline paths to the workspace layout section. After the line for `SCENE_PLAN.md`, add:

```xml
- /workspace/docs/guidelines/editing-style.md — editing style guide (techniques, pacing, display modes)
- /workspace/docs/guidelines/studio-theme.md — studio visual theme (colors, fonts, springs, glass effects)
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/template/docs/guidelines/ packages/sandbox/src/prompts/shared/identity.xml
git commit -m "feat(sandbox): add guideline files to workspace template"
```

---

## Task 2: Trim Editor Prompt Update

Minor update — add prerequisite section clarifying that word-level transcript must exist before this agent runs.

**Files:**
- Modify: `packages/sandbox/src/prompts/trim-editor/system.md`

- [ ] **Step 1: Read current trim-editor prompt**

Read `packages/sandbox/src/prompts/trim-editor/system.md` (currently ~38 lines).

- [ ] **Step 2: Add prerequisite section**

After the `<role>` tag and before `<rules>`, add:

```xml
<prerequisite>
Word-level transcript with timing (startMs, endMs per word) must exist at `/workspace/docs/transcript.json` before you run. This comes from a transcription step during upload — it is NOT your job to transcribe. The transcript is the source of truth for all timing.
</prerequisite>
```

- [ ] **Step 3: Update caption generation instruction**

In the rules/task section, ensure the caption generation step says "Generates captions on a dedicated caption track **from the word-level transcript**" (not "generates captions" alone, which is ambiguous about the source).

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/trim-editor/system.md
git commit -m "feat(sandbox): add transcript prerequisite to trim editor prompt"
```

---

## Task 3: Planner Prompt — Major Rewrite

Complete rewrite of the planner prompt. The planner now receives the editing style guide and outputs a structured per-scene schema that the Layout Editor can execute mechanically.

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`
- Modify: `packages/sandbox/src/prompts/planner/reminder.md`
- Modify: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

**Key references:**
- Spec: "Planner" section — input, output schema, what planner decides/doesn't decide
- Spec: "Per-scene entry schema" — the exact schema format with Speaker layout, Scene placement, Transitions, Animation brief
- `docs/agent-overhaul/styles/motion-graphics-focused.md` — the editing style the planner follows

- [ ] **Step 1: Read current planner prompt and spec**

Read these files to understand both the current pattern and the target:
- `packages/sandbox/src/prompts/planner/system.md` (current, 51 lines)
- `packages/sandbox/src/prompts/planner/reminder.md`
- `packages/sandbox/src/prompts/planner/examples/good-plan.md`
- `docs/superpowers/specs/2026-03-19-agent-overhaul-design.md` (sections: Planner, Per-scene entry schema)

- [ ] **Step 2: Rewrite planner/system.md**

Replace the entire content. The new prompt must follow the same XML-tagged structure (`<role>`, `<rules>`, `<task>`) as the current prompt but with expanded content. Key sections:

**`<role>`** — Senior creative director. Produces `/workspace/docs/SCENE_PLAN.md`. Contract between all agents.

**`<rules>`**

1. **Planning Process** (updated):
   - Step 1: Read `/workspace/docs/guidelines/editing-style.md` — this is your playbook
   - Step 2: Read `/workspace/docs/transcript.json` (post-trim timestamps)
   - Step 3: Read `/workspace/docs/speaker-grid.json` (head tracking, if available)
   - Step 4: Read `/workspace/docs/guidelines/studio-theme.md` — understand the visual system
   - Step 5: Use `render_still` at 3-5 representative moments to check speaker position
   - Step 6: Perform 4-pass transcript analysis (content → story arc → sync points → visual continuity)
   - Step 7: Write `/workspace/docs/SCENE_PLAN.md`

2. **Per-Scene Entry Schema** (NEW — from spec):
   Every scene entry follows this exact structure:
   ```
   ## Scene N: [Name]
   **Time:** startMs – endMs
   **Transcript:** "exact words the speaker says"
   **Display mode:** fullscreen | split-screen [top%/bottom%] | overlay
   **Energy:** 1-5

   ### Speaker layout (for Layout Editor)
   - Speaker transform: { x, y, width, height } — OR "opacity: 0" for fullscreen
   - Speaker crop: { x, y, scale } — optional, for punch-in

   ### Scene placement (for Layout Editor)
   - Scene dimensions: widthxheight
   - Scene transform: { x, y, width, height }
   - Track: overlay
   - Z-order: above speaker, below captions

   ### Transitions (for Layout Editor)
   - Entry: crossfade 12f | flash 3f | none
   - Exit: crossfade 12f | fade 8f | none

   ### Animation brief (for Animator)
   - Scene type: step-cards | comparison | flowchart | data-viz | definition | timeline | hierarchy | cause-effect | progress | custom
   - Description: "detailed visual description"
   - Key data: [items from transcript]
   - Must show: exact items/numbers from transcript
   ```

3. **Display Modes** (from spec):
   - **fullscreen**: Animation fills entire canvas. Speaker video kept but opacity 0 (audio continues). Max 15 consecutive seconds.
   - **split-screen [top%/bottom%]**: Speaker scales to bottom portion, animation fills top. Default 55/45. Speaker transform specifies exact { x, y, width, height }.
   - **overlay**: Speaker at full size. Scene rendered at natural dimensions (NOT canvas size), placed via transform. NEVER cover face. NEVER overlap captions.

4. **Overlay Scene Rules** (from spec):
   - Dimension scene to exactly what it needs — a lower third is 800x120, not 1080x1920
   - Typical overlay dimensions table (from spec: lower third 700-900x100-140, heading 600-900x60-80, stat callout 200-350x120-200, etc.)
   - Safe zones: above head, sides, below face above captions, corners
   - Speaker-grid.json provides face position. Fallback: face centered in top 40%

5. **Scene Content Strategy** (from editing style guide):
   - Enumeration → numbered step cards
   - Comparison → side-by-side columns
   - Process → animated flowchart
   - Data → animated bar/ring/counter
   - Definition → glass card with term
   - Timeline → horizontal timeline
   - Hierarchy → tree diagram
   - Cause & Effect → arrow chain
   - Quantity/Scale → proportional shapes

6. **When NOT to Add a Scene** (from editing style):
   - Personal anecdote — let them talk face-to-camera
   - Rhetorical question — let the pause land
   - Emotional moment — don't cover their face
   - Concept already clear — don't add just to fill time
   - Two scenes < 3 seconds apart — consolidate or skip

7. **Pacing Rules** (from editing style):
   - Never more than 8 seconds of speaker-only without a visual
   - Scenes should cover 40-60% of total video duration
   - Speaker-only segments: 20-35%
   - Scene duration: 5-15 seconds per scene
   - Never more than 3 consecutive fullscreen scenes

8. **Punch-in & Multi-angle Sections** (from spec):
   - List punch-in locations within speaker-only segments (timestamp, crop { x, y, scale })
   - List multi-angle cut positions (timestamp, crop regions)
   - 1-2 punch-ins per minute, never during a scene

9. **Energy Arc** (keep from current prompt):
   - Map each scene to energy 1-5
   - No two adjacent at same energy level
   - Hook: energy 4-5
   - At least one dip (1-2) before final peak

10. **Global Section** in SCENE_PLAN.md:
    - Canvas dimensions
    - Caption style (font, color, active word color, display mode)
    - Energy arc summary
    - Total scene count

**`<task>`** — Read transcript and guidelines. Perform 4-pass analysis. Write SCENE_PLAN.md with global section, per-scene entries following the exact schema, punch-in/multi-angle locations, and self-verification table.

- [ ] **Step 3: Rewrite planner/reminder.md**

The critical reminder (sandwich pattern at bottom of prompt). Must include:

```markdown
<critical_reminder>
Every scene MUST have: display mode, exact Speaker layout { x, y, width, height }, exact Scene placement { x, y, width, height }, transitions, animation brief with scene type + description + key data.

Overlay scenes: dimension to content (NOT canvas size). NEVER cover the speaker's face. Use speaker-grid.json for face position, fallback to top 40%.

Fullscreen scenes: speaker opacity 0 (NOT removed — audio must continue).

Split-screen: speaker transform specifies exact position and size in pixels.

Scene dimensions in Scene placement MUST match the scene's render size. The Layout Editor executes your plan mechanically — ambiguity will cause errors.

Punch-ins: { x, y, scale } where x/y are center-point percentages (0-100), scale is zoom factor (e.g., 1.3 for 130%).

Read /workspace/docs/guidelines/editing-style.md FIRST — it is your playbook.
</critical_reminder>
```

- [ ] **Step 4: Rewrite planner/examples/good-plan.md**

Replace with an example SCENE_PLAN.md that uses the new per-scene entry schema. Include:
- A global section with canvas 1080x1920, caption style, energy arc summary
- 3 example scenes:
  1. A split-screen 55/45 scene (step cards)
  2. An overlay scene (lower third, 800x120)
  3. A fullscreen scene (data visualization)
- Punch-in locations section
- Self-verification table

This example should be ~80-120 lines showing the exact format the planner must output.

- [ ] **Step 5: Verify prompt loads**

```bash
cd packages/sandbox && npx tsx -e "
import { assembleAgentPrompt } from './src/prompts/prompt-loader.js';
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
const p = await assembleAgentPrompt('planner', ctx);
console.log('Planner prompt length:', p.length, 'chars');
console.log('Contains schema:', p.includes('Speaker layout'));
console.log('Contains editing style ref:', p.includes('editing-style.md'));
"
```

Expected: Prompt loads without error, contains "Speaker layout" and "editing-style.md".

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/planner/
git commit -m "feat(sandbox): rewrite planner prompt with per-scene entry schema"
```

---

## Task 4: Setup Agent Prompt (New)

Brand new agent. Scaffolds the workspace before parallel animators run — writes `constants.ts`, `Background.tsx`, and shared components derived from the studio theme.

**Files:**
- Create: `packages/sandbox/src/prompts/setup-agent/system.md`
- Create: `packages/sandbox/src/prompts/setup-agent/reminder.md`

**Key references:**
- Spec: "Setup Agent" section
- `docs/agent-overhaul/themes/viona-glass.md` — the theme this agent reads and converts to code

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/sandbox/src/prompts/setup-agent
```

- [ ] **Step 2: Write setup-agent/system.md**

Structure follows existing agent pattern (`<role>`, `<rules>`, `<task>`):

**`<role>`** — Workspace scaffolding engineer. You prepare shared code files so parallel animators can run. All animators import from your files — if they don't exist, every animator fails.

**`<rules>`**

1. **Input:**
   - Plan at `/workspace/docs/SCENE_PLAN.md`
   - Studio theme at `/workspace/docs/guidelines/studio-theme.md`

2. **What you create:**

   a. **`/workspace/src/constants.ts`** — Extract ALL design tokens from the studio theme into typed constants:
   ```typescript
   export const COLORS = {
     background: '#08080C',
     surface: '#1C1C23',
     primary: '#8B5CF6',
     // ... all colors from theme
   };
   export const GLASS = {
     background: 'rgba(28, 28, 35, 0.55)',
     backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
     // ... all glass properties
   };
   export const SPRING_CONFIG = { damping: 30, mass: 1, stiffness: 500 };
   export const TIMING = { stagger: 8, entrance: 20, exit: 12, holdMin: 30 };
   export const FONTS = { heading: 'Sora', body: 'Sora', mono: 'JetBrains Mono' };
   export const SPACING = { canvasMargin: 48, elementGap: 24, cardPadding: 28 };
   // ... etc.
   ```
   Every value must match the studio theme exactly. Read the theme file and extract.

   b. **`/workspace/src/components/Background.tsx`** — Shared animated background component:
   - Props: `variant` ('solid' | 'gradient' | 'mesh'), `colors` (optional override), `opacity` (optional)
   - `solid` — single color fill using `COLORS.background`
   - `gradient` — linear gradient using dark theme colors
   - `mesh` — radial gradient mesh (violet/blue tints from theme)
   - Import COLORS from `../constants`

   c. **`/workspace/src/components/GlassCard.tsx`** — Reusable glass card wrapper:
   - Props: `children`, `padding?`, `borderRadius?`, `style?`
   - Applies full glass recipe from theme (bg, backdrop-filter, border, borderTop specular, shadow)
   - Import GLASS from `../constants`

   d. **Any other shared components** referenced in the plan (check SCENE_PLAN.md for recurring visual patterns)

   e. **Ensure `src/scenes/` directory exists** (animators write here)

3. **Rules:**
   - Read the studio theme file FIRST — every constant must match
   - Use the `Write` tool for all files (constants.ts, component .tsx files in src/components/)
   - Do NOT use `write_scene_file` — that's for scene files in src/scenes/, which animators create
   - After writing all files, run `npx tsc --noEmit --pretty false` to verify compilation
   - If errors: fix and re-run (max 2 attempts)
   - Call `trigger_rebuild` after all files are written
   - Do NOT modify the manifest — that's the Layout Editor's job
   - Do NOT write scene files — that's the Animators' job

**`<task>`** — Read the plan and studio theme. Write constants.ts, Background.tsx, GlassCard.tsx, and any other shared components. Verify compilation. Trigger rebuild.

- [ ] **Step 3: Write setup-agent/reminder.md**

```markdown
<critical_reminder>
Read /workspace/docs/guidelines/studio-theme.md FIRST. Every value in constants.ts must match the theme exactly.

Files you create: constants.ts, Background.tsx, GlassCard.tsx, any plan-referenced shared components.

After writing all files: tsc --noEmit → fix errors → trigger_rebuild.

Do NOT touch the manifest. Do NOT write scene files. Your job is shared infrastructure only.
</critical_reminder>
```

- [ ] **Step 4: Verify prompt loads**

```bash
cd packages/sandbox && npx tsx -e "
import { assembleAgentPrompt } from './src/prompts/prompt-loader.js';
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
const p = await assembleAgentPrompt('setup-agent', ctx);
console.log('Setup Agent prompt length:', p.length, 'chars');
console.log('Contains studio-theme ref:', p.includes('studio-theme.md'));
"
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/
git commit -m "feat(sandbox): add Setup Agent prompt"
```

---

## Task 5: Layout Editor Prompt (New)

Brand new agent. Reads SCENE_PLAN.md and mechanically executes it on the manifest — splits video, sets transforms, places mockups, creates tracks.

**Files:**
- Create: `packages/sandbox/src/prompts/layout-editor/system.md`
- Create: `packages/sandbox/src/prompts/layout-editor/reminder.md`
- Create: `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`

**Key references:**
- Spec: "Layout Editor" section — what it does, implementation notes
- Spec: "Per-scene entry schema" — what the plan looks like (Layout Editor reads the "Speaker layout", "Scene placement", "Transitions" sections)

- [ ] **Step 1: Create directories**

```bash
mkdir -p packages/sandbox/src/prompts/layout-editor/examples
```

- [ ] **Step 2: Write layout-editor/system.md**

**`<role>`** — Timeline skeleton builder. You read SCENE_PLAN.md and execute it mechanically on the manifest. You do NOT make creative decisions — the plan specifies everything. Your job is precise manifest manipulation.

**`<rules>`**

1. **Input:**
   - Plan at `/workspace/docs/SCENE_PLAN.md`
   - Current manifest (post-setup)
   - Speaker head tracking at `/workspace/docs/speaker-grid.json` (if available — use to validate overlay placements don't cover face. Fallback: face centered in top 40% of frame.)

2. **Process (in this exact order):**

   a. **Read the plan and speaker-grid.json** — parse all scene entries, punch-in locations, multi-angle cuts. Note face position for overlay validation.

   b. **Create overlay tracks** — one per scene (or reuse tracks when scenes don't overlap in time). Track type: `overlay`. Position overlay tracks above the video track.

   c. **Split video at scene boundaries** — use `split_item` at each scene's startMs. Process splits in REVERSE chronological order (later splits first) to avoid timestamp shifting.

   d. **Split video at punch-in points** — split at each punch-in timestamp. Apply the crop `{ x, y, scale }` from the plan to the punched-in segment via `update_item` data.crop.

   e. **Split video at multi-angle cut points** — split and apply different crop regions to simulate angle switches.

   f. **Set speaker transforms per scene** — for each scene's time range, update the corresponding video segment(s):
      - **fullscreen**: set opacity to 0 via keyframes (item must remain for audio). Add keyframe at scene startMs with `opacity: 0`, at endMs with `opacity: 1`.
      - **split-screen**: update transform to the plan's `Speaker layout` values `{ x, y, width, height }`
      - **overlay**: no transform change (speaker stays full size)

   g. **Place mockup placeholder items** — for each scene, add a shape item (rectangle) on the overlay track:
      - `type: 'shape'`
      - `data: { shape: 'rectangle', fill: '#8B5CF6' }` (violet for content, '#3B82F6' blue for overlay)
      - `transform`: from the plan's `Scene placement` values `{ x, y, width, height }`
      - `startMs`, `endMs`: from the plan's time range
      - Store the scene name in `data.sceneFile` so Final Editor can match mockups to real scenes
      - Store `data.displayMode` for identification

   h. **Apply transitions** — for each scene entry's Transitions section:
      - **crossfade**: add opacity keyframes (0→1 over N frames at scene start, 1→0 over N frames at scene end) to the mockup item
      - **flash**: add a white shape item (2-3 frames, 80% opacity) between major sections
      - **none**: skip

   i. **Verify with render_still** — render stills at 2-3 scene boundaries to verify layout is correct

3. **Critical Rules:**
   - Process ALL splits in REVERSE chronological order — later timestamps first
   - Audio and video from same source are MARRIED — split_item handles both
   - Never modify scene file content — your job is manifest only
   - Every mockup must have `data.sceneFile` set so Final Editor can find it
   - Caption track must remain untouched (Trim Editor already created it)
   - Overlay tracks must be positioned ABOVE video track and BELOW caption track

**`<task>`** — Read SCENE_PLAN.md. Create overlay tracks. Split video at all boundaries (reverse order). Set speaker transforms per display mode. Place mockup placeholders with correct transforms. Apply transitions. Verify with render_still.

- [ ] **Step 3: Write layout-editor/reminder.md**

```markdown
<critical_reminder>
Split in REVERSE chronological order — always. Audio and video are married (split_item handles both).

Every mockup shape item MUST have data.sceneFile (scene name) and data.displayMode set.

Fullscreen: speaker opacity 0 via keyframes (NOT removed — audio continues).
Split-screen: speaker transform from plan's Speaker layout { x, y, width, height }.
Overlay: speaker stays full size (no change).

Overlay tracks: type 'overlay', positioned above video, below captions.

Read speaker-grid.json (if available) to validate overlay placements don't cover face. Fallback: face centered in top 40%.

You execute the plan mechanically. Zero creative decisions.
</critical_reminder>
```

- [ ] **Step 4: Write layout-editor/examples/good-layout.md**

Write a concrete example showing:
1. Reading a 3-scene plan (one split-screen, one overlay, one fullscreen)
2. The exact tool calls in order: add_track → split_item (reverse) → update_item (transforms) → add_item (mockups) → add_item (flash transition)
3. The expected manifest state after each operation

This should be ~60-80 lines showing the mechanical execution pattern.

- [ ] **Step 5: Verify prompt loads**

```bash
cd packages/sandbox && npx tsx -e "
import { assembleAgentPrompt } from './src/prompts/prompt-loader.js';
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
const p = await assembleAgentPrompt('layout-editor', ctx);
console.log('Layout Editor prompt length:', p.length, 'chars');
console.log('Contains split rule:', p.includes('REVERSE chronological'));
"
```

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/
git commit -m "feat(sandbox): add Layout Editor prompt"
```

---

## Task 6: Animator Prompt Assembly Update

Update `prompt-assembly.ts` to support overlay scenes. The animator needs to know whether it's building a content scene (with background) or an overlay scene (transparent background, sized to content).

**Files:**
- Modify: `packages/sandbox/src/prompt-assembly.ts`

- [ ] **Step 1: Read current prompt-assembly.ts**

Read `packages/sandbox/src/prompt-assembly.ts` to understand the current structure.

- [ ] **Step 2: Extend SceneConfig interface**

Add new fields to `SceneConfig`:

```typescript
export interface SceneConfig {
  sceneName: string;
  sceneFile: string;
  sceneBrief: string;
  syncPoints: Array<{ frame: number; action: string }>;
  durationFrames: number;
  canvasWidth: number;      // full canvas width (for reference)
  canvasHeight: number;     // full canvas height (for reference)
  sceneWidth: number;       // actual scene render width
  sceneHeight: number;      // actual scene render height
  fps: number;
  theme: string;
  displayMode: 'fullscreen' | 'split-screen' | 'overlay';
}
```

Note: `sceneWidth`/`sceneHeight` may equal `canvasWidth`/`canvasHeight` for fullscreen scenes, or be smaller for overlay scenes (e.g., 800x120 for a lower third).

- [ ] **Step 3: Update buildAnimatorPrompt()**

Update the canvas dimensions line and add overlay-specific rules:

```typescript
export async function buildAnimatorPrompt(config: SceneConfig): Promise<string> {
  const themeContent = await loadThemeContent(config.theme);
  const isOverlay = config.displayMode === 'overlay';

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
    isOverlay ? OVERLAY_RULES : LAYOUT_RULES,
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
```

- [ ] **Step 4: Add OVERLAY_RULES constant**

Add a new constant after `LAYOUT_RULES`:

```typescript
const OVERLAY_RULES = `
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
- All element sizes should be relative to your scene dimensions, not the full canvas

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
```

**Note:** The template literal references `config.sceneWidth` and `config.sceneHeight` which won't work as a static string. Instead, make `OVERLAY_RULES` a function that returns the string:

```typescript
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
```

Also update `LAYOUT_RULES` from a static constant to a function `layoutRules(config: SceneConfig)` that references `sceneWidth`/`sceneHeight`:

```typescript
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
`;
}
```

Then in `buildAnimatorPrompt`: `isOverlay ? overlayRules(config) : layoutRules(config)`

- [ ] **Step 5: Update loadThemeContent path**

Update `loadThemeContent` to also check the new guideline path:

```typescript
async function loadThemeContent(theme: string): Promise<string> {
  const paths = [
    // New guideline path (preferred)
    join(WORKSPACE, 'docs', 'guidelines', 'studio-theme.md'),
    // Legacy paths (fallback)
    join(WORKSPACE, 'docs', 'themes', 'studio', 'design-system.md'),
    join(WORKSPACE, 'docs', 'themes', 'studio', `${theme.includes('light') ? 'light' : 'dark'}`, 'style-guide.md'),
  ];
  // ... rest unchanged
}
```

- [ ] **Step 6: Update formatSceneBrief**

Update `formatSceneBrief` to include display mode and render dimensions:

```typescript
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
- Import from \`../constants\` and \`../components/Background\` (already exist)${config.displayMode === 'overlay' ? '\n- Do NOT use Background component — this is an overlay scene (transparent background)' : ''}
- Export the component as the default export AND as a named export matching the filename
- The component receives \`width\`, \`height\`, \`durationInFrames\`, and \`fps\` props
`;
}
```

- [ ] **Step 7: Verify compilation**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: No errors in prompt-assembly.ts

- [ ] **Step 8: Commit**

```bash
git add packages/sandbox/src/prompt-assembly.ts
git commit -m "feat(sandbox): add overlay scene support to animator prompt assembly"
```

---

## Task 7: Final Editor Prompt (New)

Brand new agent. Replaces the Visual Editor Phase 7 (final assembly). Hooks everything together — replaces mockups with real scene items, styles captions, validates tracks.

**Files:**
- Create: `packages/sandbox/src/prompts/final-editor/system.md`
- Create: `packages/sandbox/src/prompts/final-editor/reminder.md`

**Key references:**
- Spec: "Final Editor" section
- Current visual-editor prompt Phase 7 section (for existing patterns): `packages/sandbox/src/prompts/visual-editor/system.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/sandbox/src/prompts/final-editor
```

- [ ] **Step 2: Write final-editor/system.md**

**`<role>`** — Final assembly editor. You hook everything together after animations are complete. Replace mockup placeholders with real scene items, apply caption styling, and validate the entire timeline.

**`<rules>`**

1. **Input:**
   - Plan at `/workspace/docs/SCENE_PLAN.md`
   - Manifest with mockups (from Layout Editor)
   - Completed scene files in `/workspace/src/scenes/`
   - Speaker head tracking at `/workspace/docs/speaker-grid.json` (if available — for overlay face-zone validation. Fallback: face centered in top 40% of frame.)

2. **Process:**

   a. **Read manifest and plan** — identify all mockup shape items (shapes with `data.sceneFile` set)

   b. **Replace mockups with scene items** — for each mockup:
      - Remove the mockup shape item via `remove_item`
      - Add a new scene item via `add_item` on the same track, same time range, same transform
      - `type: 'scene'`, `data: { sceneFile: 'scenes/{sceneName}.tsx' }`
      - Preserve the transform (x, y, width, height) from the mockup
      - Preserve any keyframes (opacity transitions) from the mockup

   c. **Apply caption styling** — use `update_caption_style` with the global style from the plan:
      - `displayMode`, `fontFamily`, `fontSize`, `fontWeight`
      - `color`, `activeColor`, `backgroundColor`
      - `animation` (entrance/active/exit effects)
      - `position` (anchor, offset)

   d. **Validate all tracks:**
      - No two items on the same track at the same time (check for overlaps)
      - Correct track z-ordering: video tracks at bottom, overlay tracks in middle, caption track on top
      - No gaps in the video track (continuous speaker audio)
      - All scene files referenced in scene items actually exist in `/workspace/src/scenes/`
      - Run `validate_timeline` tool for structural validation

   e. **Verify overlay placements:**
      - Read speaker-grid.json (if available) to confirm no overlay covers the face
      - Fallback: assume face centered in top 40% of frame
      - Check no overlay item's transform overlaps with the caption area (bottom ~15%)

   f. **Verify transitions:**
      - Crossfade opacity keyframes are correctly timed
      - Flash items are present between major sections as planned
      - No abrupt hard cuts where the plan specified a transition

   g. **Render verification stills:**
      - Render 3-5 stills at key moments (first scene boundary, mid-video, last scene boundary, an overlay moment)
      - Verify scenes are visible, speaker is visible in split-screen/overlay, captions are readable

3. **Rules:**
   - Read the manifest BEFORE making any changes
   - Process replacements one at a time — read, remove mockup, add scene item, verify
   - Do NOT modify scene files — the animators already wrote them
   - Do NOT change scene timing — the Layout Editor already set it
   - If a scene file is missing, report it but continue with other replacements

**`<task>`** — Read manifest and plan. Replace all mockup placeholders with real scene items. Apply caption styling. Validate tracks (overlaps, z-order, gaps, scene file existence). Verify overlay placements don't cover face. Render verification stills.

- [ ] **Step 3: Write final-editor/reminder.md**

```markdown
<critical_reminder>
Read manifest BEFORE editing. Replace mockups ONE at a time: remove_item → add_item (scene type) with same track, time, transform.

Mockup identification: shape items with data.sceneFile set.

Scene items: type 'scene', data { sceneFile: 'scenes/{name}.tsx' }.

Caption styling: update_caption_style with global style from plan.

Track z-order: video (bottom) → overlay (middle) → caption (top).

Verify: no overlaps, no gaps, all scene files exist, overlays don't cover face, transitions correct.

Render 3-5 stills to verify visually.
</critical_reminder>
```

- [ ] **Step 4: Verify prompt loads**

```bash
cd packages/sandbox && npx tsx -e "
import { assembleAgentPrompt } from './src/prompts/prompt-loader.js';
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
const p = await assembleAgentPrompt('final-editor', ctx);
console.log('Final Editor prompt length:', p.length, 'chars');
console.log('Contains mockup rule:', p.includes('data.sceneFile'));
"
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/final-editor/
git commit -m "feat(sandbox): add Final Editor prompt"
```

---

## Task 8: Orchestrator Prompt — Rewrite

Major rewrite of Viona's system prompt. New pipeline flow with 7 agents, proactive behavior, review capabilities.

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md`

**Key references:**
- Spec: "Viona (Orchestrator)" section — role, context, proactive behavior
- Spec: "Pipeline Flow" — the 12-step pipeline
- Current orchestrator prompt: `packages/sandbox/src/prompts/orchestrator/system.md` (216 lines)

- [ ] **Step 1: Read current orchestrator prompt**

Read `packages/sandbox/src/prompts/orchestrator/system.md` to understand the personality, streaming behavior, and fuzzy reference matching sections — these should be PRESERVED.

- [ ] **Step 2: Rewrite orchestrator/system.md**

Preserve from current prompt:
- Personality section (write like a person with taste, no filler, no hedging, warm but direct)
- Streaming behavior (extended thinking for internal, zero text before short tools, one sentence before subagent)
- Fuzzy reference matching
- Content type detection

Replace/rewrite:
- **Pipeline phases** — new 7-agent flow instead of old 8 phases
- **Subagent reference table** — 6 agents (trim_editor, planner, setup_agent, layout_editor, animator, final_editor)
- **Proactive behavior section** — expanded from spec
- **Review capability** — Viona renders stills and dispatches fix agents
- **Widget usage** — scene_plan widget after planner

New pipeline phases:

```markdown
## Pipeline

### Phase 1: Brief & Clarification (no subagent)
Read the transcript. Understand the content. Ask user 2-3 clarifying questions about creative direction:
- What's the goal of this video? (educate, sell, entertain)
- Any specific visual preferences? (minimal, data-heavy, energetic)
- Any sections to emphasize or downplay?

### Phase 2: Trimming → dispatch trim_editor
Dispatch Trim Editor to clean the timeline — remove fillers, silences, retakes. Creates captions.

### Phase 3: Planning → dispatch planner
Dispatch Planner with the editing style guide and user's answers. Planner outputs SCENE_PLAN.md.
After planner returns, show the scene_plan widget to the user for approval.
Wait for user to approve or request changes.

### Phase 4: Setup → dispatch setup_agent
Dispatch Setup Agent to scaffold workspace (constants.ts, Background.tsx, shared components).

### Phase 5: Layout → dispatch layout_editor
Dispatch Layout Editor to build the timeline skeleton (splits, transforms, mockups, tracks, transitions).

### Phase 6: Animation → dispatch multiple animators IN PARALLEL
For each scene in the plan, dispatch an animator with:
- The scene brief from SCENE_PLAN.md
- Exact dimensions (sceneWidth × sceneHeight)
- Display mode (fullscreen, split-screen, overlay)
- Duration and sync points
- Studio theme reference

**Dispatch ALL animators at once.** Do not wait for one to finish before starting the next. The SDK handles parallel Agent calls.

### Phase 7: Review (Viona does this herself)
After all animators return:
- Render stills at key sync frames for each scene
- Inspect the rendered output
- Check that scenes match the plan's description
- Check overlay scenes don't cover the speaker's face
- If issues found: dispatch a fix agent (animator subagent) with specific feedback
- Max 2 fix rounds per scene

### Phase 8: Final Assembly → dispatch final_editor
Dispatch Final Editor to replace mockups with real scenes, style captions, validate tracks.

### Phase 9: Final Review (Viona does this herself)
After Final Editor returns:
- Render 3-5 stills across the video
- Verify overall quality
- If issues found: dispatch fix agents or do minor manifest tweaks herself

### Phase 10: Done
Tell the user the video is ready. Offer to make any changes.
```

New proactive behavior section:

```markdown
## Proactive Creative Director

You are NOT a passive tool. You are the creative director. You:
- Make creative decisions without waiting for the user to specify every detail
- Anticipate what the video needs by reading the transcript
- Know ALL your capabilities: you can dispatch 6 different subagents, edit the manifest, render stills, search for assets
- Tell your team (subagents) exactly what to do based on your creative vision
- Review output critically and catch issues BEFORE the user sees them
- Have opinions about pacing, energy, visual density — share them
- If the plan seems wrong after seeing the results, adjust it
```

New subagent reference:

```markdown
## Subagents

| Agent | Key | When | What it does |
|-------|-----|------|--------------|
| Trim Editor | trim_editor | Phase 2 | Removes fillers/silences, creates captions |
| Planner | planner | Phase 3 | Creates SCENE_PLAN.md with full visual plan |
| Setup Agent | setup_agent | Phase 4 | Scaffolds shared code (constants, components) |
| Layout Editor | layout_editor | Phase 5 | Builds timeline skeleton from plan |
| Animator | animator | Phase 6 | Writes Remotion .tsx scene files (dispatched in parallel) |
| Final Editor | final_editor | Phase 8 | Replaces mockups, styles captions, validates |
```

- [ ] **Step 3: Verify prompt loads**

```bash
cd packages/sandbox && npx tsx -e "
import { loadPrompt } from './src/prompts/prompt-loader.js';
const p = await loadPrompt('orchestrator/system');
console.log('Orchestrator prompt length:', p.length, 'chars');
console.log('Contains setup_agent:', p.includes('setup_agent'));
console.log('Contains layout_editor:', p.includes('layout_editor'));
console.log('Contains final_editor:', p.includes('final_editor'));
console.log('Contains parallel:', p.includes('PARALLEL') || p.includes('parallel'));
"
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md
git commit -m "feat(sandbox): rewrite orchestrator prompt for 7-agent pipeline"
```

---

## Task 9: Orchestrator Code — Agent Definitions

Update `orchestrator.ts` to replace the 5-agent definitions with the new 7-agent set. This is a TypeScript code change.

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts`

- [ ] **Step 1: Read current orchestrator.ts**

Read `packages/sandbox/src/orchestrator.ts` fully to understand the current structure.

- [ ] **Step 2: Update prompt loading in buildOrchestratorOptions()**

Replace the old 5-prompt parallel load with the new 6-prompt load (orchestrator + 5 subagent prompts):

```typescript
const [orchestratorPrompt, trimEditorPrompt, plannerPrompt, setupAgentPrompt, layoutEditorPrompt, finalEditorPrompt] =
  await Promise.all([
    loadPrompt('orchestrator/system'),
    assembleAgentPrompt('trim-editor', ctx),
    assembleAgentPrompt('planner', ctx),
    assembleAgentPrompt('setup-agent', ctx),
    assembleAgentPrompt('layout-editor', ctx),
    assembleAgentPrompt('final-editor', ctx),
  ]);
```

Note: The animator prompt is still built per-scene via `buildAnimatorPrompt()` — it's not loaded here. The animator agent definition uses a minimal base prompt.

- [ ] **Step 3: Replace agent definitions**

Replace the `agents` object. Remove `visual_editor` and `qc_reviewer`. Add `setup_agent`, `layout_editor`, `final_editor`. Keep `trim_editor`, `planner`, `animator`.

```typescript
agents: {
  // ---- Trim Editor (Phase 2) ----
  trim_editor: {
    description: 'Trims transcript (fillers, silences, retakes), covers jump cuts with zoom punch-ins, applies J/L-cuts, generates captions.',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: trimEditorPrompt,
    },
    tools: [
      'Read', 'Write', 'Glob', 'Grep', 'Bash',
      ...MANIFEST_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
      ...ASSET_TOOL_NAMES,
      ...ANALYSIS_TOOL_NAMES,
    ],
    model: 'opus',
    skills: ['cutting-and-pacing', 'transcript-analysis', 'transitions'],
  },

  // ---- Planner (Phase 3) ----
  planner: {
    description: 'Analyzes transcript with editing style guide, designs spatial layout, creates SCENE_PLAN.md with per-scene entries (speaker layout, scene placement, transitions, animation brief).',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: plannerPrompt,
    },
    tools: [
      'Read', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
      ...MANIFEST_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
      ...ASSET_TOOL_NAMES,
      ...ANALYSIS_TOOL_NAMES,
    ],
    model: 'opus',
    skills: ['editorial-planning', 'visual-treatment-guide', 'narrative-structure', 'transcript-analysis'],
  },

  // ---- Setup Agent (Phase 4) ----
  // No SCENE_TOOL_NAMES — this agent writes to src/components/ and src/constants.ts
  // via the Write tool, NOT to src/scenes/ (that's the animators' job).
  setup_agent: {
    description: 'Scaffolds shared workspace code — constants.ts (theme tokens), Background.tsx, GlassCard.tsx, shared components. Must complete before animators start.',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: setupAgentPrompt,
    },
    tools: [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
      ...RENDER_TOOL_NAMES,
    ],
    model: 'opus',
    skills: ['remotion-best-practices', 'typescript-skills'],
  },

  // ---- Layout Editor (Phase 5) ----
  layout_editor: {
    description: 'Builds timeline skeleton from SCENE_PLAN.md — splits video, sets speaker transforms per display mode, places mockup placeholders, creates overlay tracks, applies transitions.',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: layoutEditorPrompt,
    },
    tools: [
      'Read', 'Write', 'Glob', 'Grep', 'Bash',
      ...MANIFEST_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
      ...ANALYSIS_TOOL_NAMES,
    ],
    model: 'opus',
    skills: ['cutting-and-pacing', 'transitions', 'lower-third-and-overlays'],
  },

  // ---- Animator (Phase 6) ----
  // Prompt built per-scene via buildAnimatorPrompt() — base prompt is minimal.
  animator: {
    description: 'Writes Remotion .tsx scene files. Receives per-scene prompt with dimensions, display mode, brief, sync points. Self-heals compilation errors.',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: 'You are a Remotion motion graphics engineer. Wait for a scene assignment.',
    },
    tools: ANIMATOR_TOOL_NAMES,
    model: 'opus',
    skills: ['remotion-best-practices', 'framer-motion', 'motion-one', 'video-engagement'],
  },

  // ---- Final Editor (Phase 8) ----
  final_editor: {
    description: 'Replaces mockup placeholders with real scene items, applies caption styling, validates all tracks (overlaps, z-order, gaps), verifies overlay placements, final quality pass.',
    prompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: finalEditorPrompt,
    },
    tools: [
      'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
      ...MANIFEST_TOOL_NAMES,
      ...SCENE_TOOL_NAMES,
      ...RENDER_TOOL_NAMES,
      ...ASSET_TOOL_NAMES,
      ...ANALYSIS_TOOL_NAMES,
    ],
    model: 'opus',
    skills: ['cutting-and-pacing', 'transitions', 'lower-third-and-overlays', 'platform-optimization'],
  },
},
```

- [ ] **Step 4: Update display labels**

Replace `SUBAGENT_LABELS` and `MCP_SERVER_LABELS`:

```typescript
const MCP_SERVER_LABELS: Record<string, string> = {
  manifest: 'Editor',
  scenes: 'Animator',
  render: 'Renderer',
  widgets: 'Viona',
  assets: 'Viona',
  viewport: 'Viona',
  analysis: 'Viona',
  'better-icons': 'Animator',
  freepik: 'Animator',
};

const SUBAGENT_LABELS: Record<string, string> = {
  trim_editor: 'Trim Editor',
  planner: 'Planner',
  setup_agent: 'Setup Agent',
  layout_editor: 'Layout Editor',
  animator: 'Animator',
  final_editor: 'Final Editor',
};
```

- [ ] **Step 5: Update file header comment**

Replace the top-of-file comment to reflect the new pipeline:

```typescript
// packages/sandbox/src/orchestrator.ts
//
// Core orchestrator module for the sandbox. Builds SDK query options with
// subagent definitions (6 agents: Trim Editor, Planner, Setup Agent,
// Layout Editor, Animator, Final Editor), manages session resume,
// and streams events back to the caller via callbacks.
//
// Pipeline phases:
// 1. Brief & Clarification — Viona + user
// 2. Trimming — Trim Editor (fillers, silences, captions)
// 3. Planning — Planner (SCENE_PLAN.md with per-scene schema)
// 4. Setup — Setup Agent (constants, shared components)
// 5. Layout — Layout Editor (timeline skeleton, mockups, transforms)
// 6. Animation — Animators in PARALLEL (one per scene)
// 7. Review — Viona renders stills, dispatches fix agents
// 8. Final Assembly — Final Editor (replace mockups, captions, validation)
// 9. Final Review — Viona spot-checks
// 10. Done
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): replace 5-agent definitions with 7-agent pipeline"
```

---

## Task 10: Cleanup — Remove Old Agents

Delete the Visual Editor and QC Reviewer prompt directories. These are fully replaced by Layout Editor + Final Editor (for Visual Editor) and Viona's review step (for QC Reviewer).

**Files:**
- Delete: `packages/sandbox/src/prompts/visual-editor/` (entire directory)
- Delete: `packages/sandbox/src/prompts/qc-reviewer/` (entire directory)

- [ ] **Step 1: Verify no remaining references to old agents**

Search the codebase for references to `visual-editor`, `visual_editor`, `qc-reviewer`, `qc_reviewer`:

```bash
cd packages/sandbox && grep -r "visual.editor\|qc.reviewer" src/ --include="*.ts" --include="*.md" -l
```

Expected: Only hits in the prompt directories being deleted (and possibly old comments). The orchestrator.ts should have been updated in Task 9 to no longer reference these.

- [ ] **Step 2: Delete old prompt directories**

```bash
rm -rf packages/sandbox/src/prompts/visual-editor
rm -rf packages/sandbox/src/prompts/qc-reviewer
```

- [ ] **Step 3: Verify no import errors**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Expected: No errors — prompt-loader.ts loads prompts dynamically by directory name, so deleting unused directories causes no import errors.

- [ ] **Step 4: Commit**

```bash
git add -u packages/sandbox/src/prompts/visual-editor/ packages/sandbox/src/prompts/qc-reviewer/
git commit -m "chore(sandbox): remove visual-editor and qc-reviewer prompts (replaced)"
```

---

## Task 11: Integration Verification

Verify the entire prompt system loads correctly and the orchestrator builds valid options.

**Files:**
- Create: `scripts/temp/verify-agent-pipeline.ts` (verification script)

- [ ] **Step 1: Write verification script**

Create `scripts/temp/verify-agent-pipeline.ts`:

```typescript
// Quick verification that all new prompts load and orchestrator options build correctly.
import { assembleAgentPrompt, loadPrompt, injectContext } from '../../packages/sandbox/src/prompts/prompt-loader.js';
import { buildAnimatorPrompt, type SceneConfig } from '../../packages/sandbox/src/prompt-assembly.js';

const ctx = {
  canvasWidth: 1080,
  canvasHeight: 1920,
  fps: 30,
  durationMs: 60000,
  hasTranscript: true,
  theme: 'studio-dark',
  projectType: 'tutorial',
  briefSummary: 'Test video about product design',
  hasHeadTracking: true,
  totalScenes: 5,
  currentPhase: 'planning',
};

async function verify() {
  console.log('=== Prompt Loading Verification ===\n');

  // 1. Orchestrator prompt
  const orchestrator = await loadPrompt('orchestrator/system');
  const injected = injectContext(orchestrator, ctx);
  console.log(`✓ Orchestrator: ${injected.length} chars`);
  console.assert(injected.includes('setup_agent'), 'Missing setup_agent reference');
  console.assert(injected.includes('layout_editor'), 'Missing layout_editor reference');
  console.assert(injected.includes('final_editor'), 'Missing final_editor reference');
  console.assert(!injected.includes('visual_editor'), 'Still references visual_editor');
  console.assert(!injected.includes('qc_reviewer'), 'Still references qc_reviewer');

  // 2. All subagent prompts
  const agents = ['trim-editor', 'planner', 'setup-agent', 'layout-editor', 'final-editor'];
  for (const agent of agents) {
    const prompt = await assembleAgentPrompt(agent, ctx);
    console.log(`✓ ${agent}: ${prompt.length} chars`);
    console.assert(prompt.length > 200, `${agent} prompt seems too short`);
  }

  // 3. Animator prompt (content scene)
  const contentScene: SceneConfig = {
    sceneName: 'ThreeSteps',
    sceneFile: 'ThreeSteps',
    sceneBrief: 'Three glass cards showing benefits: faster, cheaper, better.',
    syncPoints: [{ frame: 0, action: 'First card appears' }, { frame: 30, action: 'Second card' }],
    durationFrames: 150,
    canvasWidth: 1080,
    canvasHeight: 1920,
    sceneWidth: 1080,
    sceneHeight: 1056,
    fps: 30,
    theme: 'studio-dark',
    displayMode: 'split-screen',
  };
  const contentPrompt = await buildAnimatorPrompt(contentScene);
  console.log(`✓ Animator (content): ${contentPrompt.length} chars`);
  console.assert(contentPrompt.includes('split-screen'), 'Missing display mode');

  // 4. Animator prompt (overlay scene)
  const overlayScene: SceneConfig = {
    ...contentScene,
    sceneName: 'LowerThird',
    sceneFile: 'LowerThird',
    sceneBrief: 'Glass pill with speaker name and title.',
    sceneWidth: 800,
    sceneHeight: 120,
    displayMode: 'overlay',
  };
  const overlayPrompt = await buildAnimatorPrompt(overlayScene);
  console.log(`✓ Animator (overlay): ${overlayPrompt.length} chars`);
  console.assert(overlayPrompt.includes('OVERLAY'), 'Missing overlay rules');
  console.assert(overlayPrompt.includes('transparent'), 'Missing transparent background rule');
  console.assert(overlayPrompt.includes('800'), 'Missing scene dimensions');

  // 5. Verify old prompts don't load
  for (const old of ['visual-editor', 'qc-reviewer']) {
    try {
      await assembleAgentPrompt(old, ctx);
      console.error(`✗ ${old} should NOT load (directory should be deleted)`);
    } catch {
      console.log(`✓ ${old}: correctly removed`);
    }
  }

  console.log('\n=== All checks passed ===');
}

verify().catch(console.error);
```

- [ ] **Step 2: Run verification**

```bash
cd packages/sandbox && npx tsx ../../scripts/temp/verify-agent-pipeline.ts
```

Expected: All checks pass, old agents fail to load.

- [ ] **Step 3: Run full TypeScript compilation**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false
```

Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/temp/verify-agent-pipeline.ts
git commit -m "test(sandbox): add agent pipeline verification script"
```

---

## Summary of Changes

| What changed | Why |
|---|---|
| Added guideline files to workspace template | Planner reads editing style, Setup Agent reads studio theme |
| Rewrote Planner prompt | New per-scene entry schema, editing style input, overlay scene planning |
| Created Setup Agent prompt | New agent: scaffolds constants.ts, shared components |
| Created Layout Editor prompt | New agent: builds timeline skeleton mechanically from plan |
| Created Final Editor prompt | New agent: replaces mockups, caption styling, validation |
| Rewrote Orchestrator prompt | New 10-phase pipeline, proactive behavior, Viona reviews |
| Updated orchestrator.ts | 5 agents → 7 agents (removed visual_editor, qc_reviewer; added setup_agent, layout_editor, final_editor) |
| Updated prompt-assembly.ts | Overlay scene support (displayMode, sceneWidth/Height, transparent bg rules) |
| Updated identity.xml | New guideline file paths in workspace layout |
| Updated trim-editor prompt | Added transcript prerequisite section |
| Deleted visual-editor prompts | Replaced by layout-editor + final-editor |
| Deleted qc-reviewer prompts | Replaced by Viona's review step |

### What's NOT in this plan
- **Frontend changes** — editor UI, preview, timeline display unchanged
- **New MCP tools** — existing tools are sufficient for the new pipeline
- **Stock footage / B-roll** — future phase (editing style variant)
- **Music & SFX** — future phase
- **Theme customization UI** — future

---

## Known Issues (2026-03-19)

Issues discovered during pipeline verification testing.

### Issue 1: Cannot change caption position or properties from frontend

**Status:** Open
**Severity:** High — core editing functionality missing

**Problem:**
The Trim Editor (Phase 2) creates captions and the Final Editor (Phase 8) styles them, but users cannot modify captions after the pipeline completes. No frontend controls exist for caption editing.

**What's missing:**
- Caption inspector panel (select a caption → edit text, timing, position)
- Global caption style controls (font, size, color, active word color, display mode)
- Caption position presets (top / center / bottom)
- Real-time caption preview in the editor viewport

**Architecture context:**

| Component | Role | Status |
|-----------|------|--------|
| Trim Editor | Creates caption track with phrase-based items, word-level timing | Working |
| Planner | Decides global caption style in SCENE_PLAN.md | Working |
| Final Editor | Applies caption styling, validates caption track | Working |
| Frontend editor | Caption editing after pipeline | **Missing** |

**Note:** The spec (line 700) already flags "Caption style is global" as a known limitation, and "Frontend changes" (line 712) are explicitly out of scope for this plan. This is a separate frontend task.

**Related files:**
- `apps/web/src/features/editor-v2/panels/TranscriptPanel.tsx`
- `apps/web/src/features/editor-v2/components/inspector/ItemInspector.tsx`
- `apps/web/src/features/editor-v2/components/properties/PropertiesPanel.tsx`
- `packages/shared/src/manifest.ts`

---

### Issue 2: Orchestrator skips Setup/Layout/Animator subagents for short videos

**Status:** Observation
**Severity:** Low — functional but deviates from spec

**Problem:**
During pipeline verification (42s tutorial video), the orchestrator dispatched Trim Editor and Planner via Task tool successfully, but handled Phases 4-6 (Setup, Layout, Assembly) directly — calling `add_item` 22 times itself instead of dispatching Setup Agent, Layout Editor, or Animators.

The system prompt says "you do NOT write scene code or edit files yourself. The ONLY exception is manifest tools and small fixes." The orchestrator treated all layout work as "manifest tools" since it was using `add_item`, `add_track` etc.

**Impact:**
- No custom Remotion .tsx scene files were written
- No shared components scaffolded (no constants.ts, Background.tsx)
- Video has captions + speaker transforms but no custom animations
- For longer/complex videos this would produce incomplete output

**Action:** Monitor on longer videos (2+ minutes, complex content). If the orchestrator consistently skips animation subagents, the system prompt needs stronger enforcement about when subagents are required.

---

### Issue 3: Subagent activity not shown in frontend (fixed)

**Status:** Fixed (2026-03-19)
**Severity:** Low — cosmetic

**Problem:** The orchestrator streaming handler checked `toolName === 'Agent'` to detect subagent dispatches, but the SDK uses `'Task'` for custom agents. Subagent dispatches weren't tracked in the frontend activity feed.

**Fix:** Changed `packages/sandbox/src/orchestrator.ts` line 443: `'Agent'` → `'Task'`. Docker image rebuilt.
