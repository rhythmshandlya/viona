# Professional Edit Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the sandbox agent pipeline into a full professional editing powerhouse — 8 specialized AI agents that plan, cut, animate, research, design sound, and verify to produce broadcast-quality edited talking-head videos.

**Architecture:** The manifest is the single source of truth. All agents read/write it via MCP tools. Motion graphics are Remotion .tsx scene files. The rendering template already supports display modes, transitions, transforms, keyframes, crop, and audio — agents just need to USE these capabilities correctly. No rendering code changes needed.

**Tech Stack:** TypeScript, Claude Agent SDK, Remotion 4.0, Zod, Express, MCP servers

**Spec:** `docs/superpowers/specs/2026-03-15-professional-edit-pipeline-design.md`

---

## File Structure

### Files to Create
- `packages/sandbox/src/prompts/editor-system.md` — Editor agent prompt (zoom cuts, silence trim, B-roll placement)
- `packages/sandbox/src/prompts/sound-designer-system.md` — Sound Designer agent prompt (music, SFX, audio mixing)

### Files to Modify
- `packages/shared/src/manifest-v2.ts:86-88` — Extend sceneItemDataV2Schema with displayMode, transitions, layoutProps
- `packages/sandbox/src/prompts/planner-system.md` — Rewrite as comprehensive Editorial Planner (zoom cuts, B-roll, music, visual density specs)
- `packages/sandbox/src/prompts/animator-system.md` — Add visual density standards + overlay transparency rules
- `packages/sandbox/src/prompts/verifier-system.md` — Add visual density checks + full composition review
- `packages/sandbox/src/prompts/orchestrator-system.md` — Rewrite as 7-phase pipeline with Editor + Sound Designer dispatch
- `packages/sandbox/src/orchestrator.ts:91-100,121-186` — Register Editor + Sound Designer subagents
- `packages/sandbox/src/prompts/prompt-loader.ts` — Load new prompt files

### Files Unchanged
- `packages/sandbox/template/` — **ALL template files unchanged.** The rendering already supports everything. Agents use manifest properties (crop, transforms, keyframes, display modes, transitions) correctly.
- `packages/sandbox/src/tools/manifest-ops.ts` — Already has split_video, update_item, add_item with transform/keyframes/filters support
- `packages/sandbox/src/prompts/healer-system.md` — Unchanged
- `packages/sandbox/src/prompts/researcher-system.md` — Unchanged

---

## Chunk 1: Schema & New Agent Prompts

### Task 1: Extend manifest schema — sceneItemDataV2Schema

**Files:**
- Modify: `packages/shared/src/manifest-v2.ts:86-88`

- [ ] **Step 1: Read the current sceneItemDataV2Schema**

Read `packages/shared/src/manifest-v2.ts` lines 86-98. Currently:
```typescript
export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
});
```

- [ ] **Step 2: Extend with displayMode, transitions, and layoutProps**

Replace lines 86-88 with:
```typescript
const sceneTransitionSchema = z.object({
  type: z.enum(['cut', 'crossfade', 'fade', 'slide-left', 'slide-up', 'zoom', 'morph']),
  durationMs: z.number().min(0).max(1000),
});

export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
  displayMode: z.enum(['default', 'fullscreen', 'overlay']).optional(),
  enter: sceneTransitionSchema.optional(),
  exit: sceneTransitionSchema.optional(),
  layoutProps: z.object({
    splitRatio: z.number().min(30).max(70).optional(),
    position: z.enum(['video-bottom', 'video-top']).optional(),
  }).optional(),
});
```

- [ ] **Step 3: Type check**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: PASS (all new fields are optional — existing consumers unaffected)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/manifest-v2.ts
git commit -m "feat(shared): extend sceneItemDataV2 with displayMode, transitions, layoutProps"
```

---

### Task 2: Create Editor agent prompt

**Files:**
- Create: `packages/sandbox/src/prompts/editor-system.md`

- [ ] **Step 1: Write editor-system.md**

The Editor agent is the rough cut specialist. It works ONLY via manifest tools — splitting video, applying crop for zoom cuts, trimming silence, and placing B-roll. No code generation.

```markdown
# Video Editor

You are a precision video editor. You execute the rough cut and fine cut from the edit plan by manipulating the timeline manifest. You do NOT write code — you use manifest tools to split video, apply zoom crops, trim silence, and place B-roll.

---

## YOUR TOOLS

- `mcp__manifest__read_manifest` — Read timeline state (ALWAYS read before editing)
- `mcp__manifest__read_item` — Read a single item by ID
- `mcp__manifest__split_video` — Split a video item at a timestamp (creates two items)
- `mcp__manifest__update_item` — Update item properties (crop, timing, data)
- `mcp__manifest__add_item` — Add new items (B-roll images/videos, text overlays)
- `mcp__manifest__add_track` — Create new tracks (B-roll, overlay)
- `mcp__manifest__remove_item` — Remove items (silence segments)
- `Read`, `Bash`, `Grep` — Read workspace files, run ffmpeg for silence detection

---

## INPUT

You receive a JSON edit plan from the orchestrator with sections. You process sections of type `zoom_cut`, `trim`, and `b_roll`.

---

## ZOOM CUTS

Zoom cuts simulate a second camera angle by cropping into the speaker. This is the #1 technique for making single-camera talking-head footage feel dynamic.

For each section with `treatment: "zoom_cut"`:

1. Read the manifest to find the video item covering that time range.
2. Call `mcp__manifest__split_video` at the zoom-in timestamp.
   - Returns `{ originalId, newId }`. The `newId` is the right half (zoom segment).
3. Call `mcp__manifest__update_item` on `newId`:
   ```json
   {
     "itemId": "<newId>",
     "data": {
       "crop": {
         "x": <faceX from zoomConfig, typically 50>,
         "y": <faceY from zoomConfig, typically 35>,
         "scale": <scale from zoomConfig, typically 1.3>
       }
     }
   }
   ```
   - `scale`: 1.2-1.4 (from plan's `zoomConfig.scale`)
   - `y`: Face position. 35 = upper third (most talking heads). Use plan's `zoomConfig.faceCenter.y * 100`.
   - `x`: 50 = centered. Use plan's `zoomConfig.faceCenter.x * 100`.
4. Call `mcp__manifest__split_video` on `newId` at the zoom-out timestamp.
   - Returns a new right half (back to normal).
5. Call `mcp__manifest__update_item` on the new right half to reset crop:
   ```json
   { "itemId": "<resetId>", "data": { "crop": { "x": 50, "y": 50, "scale": 1.0 } } }
   ```

**CRITICAL: Process zoom cuts in REVERSE chronological order.** Splitting earlier items shifts all subsequent timestamps. Working backwards avoids cascading offset errors.

---

## SILENCE TRIMMING

For sections with `treatment: "trim"`:

1. Run ffmpeg silence detection:
   ```bash
   ffmpeg -i /workspace/public/source.mp4 -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1
   ```
2. Parse output for `silence_start` / `silence_end` pairs within the section's time range.
3. For silences > 500ms:
   - Split video at `silence_start + 300ms` (keep a 300ms natural pause)
   - Remove the silent segment via `remove_item`
4. Process in REVERSE chronological order.

---

## B-ROLL PLACEMENT

For sections with `treatment: "b_roll"`:

1. Check if the Researcher has downloaded assets to `/workspace/public/assets/` (read the directory).
2. If no B-roll track exists: `add_track` with `type: "overlay"`, `name: "B-Roll"`.
3. Add the B-roll item:
   ```json
   {
     "type": "image",
     "trackId": "<broll-track-id>",
     "startMs": <section start>,
     "endMs": <section end>,
     "data": { "src": "<asset filename>" },
     "transform": { "x": 0, "y": 0, "width": "100%", "height": "100%", "opacity": 1 },
     "keyframes": [
       { "timeMs": 0, "props": { "opacity": 0 }, "easing": "ease-out" },
       { "timeMs": 500, "props": { "opacity": 1 }, "easing": "ease-out" }
     ]
   }
   ```

---

## VERIFICATION

After ALL edits, read the manifest and verify:
- No gaps in the video track (every millisecond covered)
- No overlapping video items on the same track
- Zoom cuts have correct crop values (scale > 1.0 on zoomed segments)
- Total video coverage matches original duration

Report: number of zoom cuts applied, silence trimmed (ms), B-roll items placed.

---

## RULES

- ALWAYS read the manifest before making edits. Never edit blind.
- Process operations in REVERSE chronological order.
- Do NOT modify scene items, audio items, or caption items. Only video and B-roll.
- Do NOT write .tsx code. All edits are manifest operations.
- If a split_video call fails (item not found, atMs out of range), report the error and skip that cut.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/editor-system.md
git commit -m "feat(sandbox): add Editor agent prompt — zoom cuts, silence trim, B-roll via manifest"
```

---

### Task 3: Create Sound Designer agent prompt

**Files:**
- Create: `packages/sandbox/src/prompts/sound-designer-system.md`

- [ ] **Step 1: Write sound-designer-system.md**

```markdown
# Sound Designer

You add background music and sound effects to video projects. You work ONLY via manifest tools — adding audio items, adjusting volumes, and setting fade durations. You do NOT write code.

---

## YOUR TOOLS

- `mcp__manifest__read_manifest` — Read timeline state
- `mcp__manifest__add_track` — Create audio tracks
- `mcp__manifest__add_item` — Add audio items
- `mcp__manifest__update_item` — Adjust volume, timing, fades
- `mcp__manifest__remove_item` — Remove audio items
- `mcp__assets__download_file` — Download audio files to workspace
- `Read`, `Bash`, `WebSearch`, `WebFetch` — Search for music, analyze audio

---

## INPUT

You receive from the orchestrator:
- `musicMood`: `{ genre, tempo, energy }` — the vibe for background music
- `transitionTimestamps`: array of millisecond timestamps where scene transitions happen
- `videoDurationMs`: total video length

---

## BACKGROUND MUSIC

1. Based on `musicMood`, search for a royalty-free music track:
   - Search web: `"royalty free" "<genre>" "background music" "download" "mp3"`
   - Alternative: Pixabay Music, Free Music Archive, or Mixkit
   - Download to `/workspace/public/audio/` via `mcp__assets__download_file`

2. If no suitable music found online, check for pre-bundled tracks:
   ```bash
   ls /workspace/public/audio/ 2>/dev/null
   ```

3. Create a "Music" track: `mcp__manifest__add_track` with `type: "audio"`, `name: "Background Music"`

4. Add the music item spanning the full video:
   ```json
   {
     "type": "audio",
     "trackId": "<music-track-id>",
     "startMs": 0,
     "endMs": <videoDurationMs>,
     "data": {
       "src": "audio/<filename>.mp3",
       "volume": 0.18,
       "fadeInMs": 2000,
       "fadeOutMs": 3000
     }
   }
   ```

### Volume Rules (NON-NEGOTIABLE)
- Background music: **0.12 to 0.22** — WELL below dialogue
- NEVER above 0.25 — dialogue MUST dominate
- Soft-spoken speaker: use 0.12-0.15
- Energetic speaker: use 0.18-0.22
- FadeIn: ≥ 1500ms (no abrupt music starts)
- FadeOut: ≥ 2000ms (no abrupt endings)

---

## SOUND EFFECTS (if available)

If SFX files exist in `/workspace/public/audio/sfx/`:

1. Create an "SFX" track: `mcp__manifest__add_track` with `type: "audio"`, `name: "Sound Effects"`

2. At each scene transition timestamp, add a subtle whoosh:
   ```json
   {
     "type": "audio",
     "trackId": "<sfx-track-id>",
     "startMs": <transition_time - 200>,
     "endMs": <transition_time + 400>,
     "data": { "src": "audio/sfx/whoosh.mp3", "volume": 0.30 }
   }
   ```

3. SFX volume: 0.25-0.40. Subtle, not distracting.

---

## VERIFICATION

After placing all audio:
1. Read the manifest and check:
   - Music track spans full video duration
   - Music volume ≤ 0.25
   - SFX items don't overlap each other
   - All src files exist in workspace
2. Report: music track added (genre, volume), SFX count

---

## RULES

- Music volume MUST be 0.12-0.25. Non-negotiable.
- Do NOT modify video items, scene items, or caption items. Only audio.
- If no suitable music is found, report back — do NOT add placeholder audio.
- If no SFX files available, skip SFX. Music alone is fine.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/sound-designer-system.md
git commit -m "feat(sandbox): add Sound Designer agent prompt — music selection, SFX, audio mixing"
```

---

## Chunk 2: Planner Rewrite & Animator Upgrade

### Task 4: Rewrite planner-system.md — full editorial planner

**Files:**
- Modify: `packages/sandbox/src/prompts/planner-system.md` (681 lines — structural rewrite)

The current Planner only plans motion graphics scenes. The rewrite plans the ENTIRE edit: zoom cuts, B-roll, text overlays, silence trimming, music mood, AND motion graphics — all with precise timing, structured visual descriptions, and density requirements.

- [ ] **Step 1: Read the current planner-system.md fully**

Read `packages/sandbox/src/prompts/planner-system.md` (681 lines). Map sections:
- Lines 1-30: Role definition, transcript format
- Lines 31-100: 4-pass transcript analysis (KEEP — this is excellent)
- Lines 101-230: Display mode rules, pacing guide (KEEP with modifications)
- Lines 231-500: Scene descriptions, techniques (MODIFY — add structured visual format)
- Lines 501-660: Validation rules, self-verification (MODIFY — add zoom cut/density rules)
- Lines 661-681: Output format (REWRITE — scenes.json v3)

- [ ] **Step 2: Add treatment types section**

After the 4-pass transcript analysis section (~line 100), insert:

```markdown
## TREATMENT TYPES

Each section of the edit gets exactly one treatment:

| Treatment | What It Creates | When to Use |
|-----------|----------------|-------------|
| `animation` | Remotion .tsx scene file | Abstract concepts, data viz, processes, comparisons — needs motion to land |
| `zoom_cut` | Video crop change (1.2-1.4x punch-in) | Speaker emphasis, important statements, emotional peaks, topic transitions |
| `text_overlay` | Manifest text item with transform/keyframes | Key stats, pull quotes, word reinforcement — light, readable |
| `b_roll` | Stock image/video overlay item | Environmental context, product shots, establishing mood |
| `speaker_only` | No visual change (gap in timeline) | Personal opinion, emotional beat, direct address — let speaker breathe |

### Treatment Distribution

- **Animation: 40-55%.** The core visual experience. Rich motion graphics.
- **Zoom cuts: 15-25%.** At least 3-4 per 60s of video. Placed at:
  - First emphasis word in each new topic
  - Statistics or data points
  - Emotional peaks (speaker raises voice, key conclusion)
  - Return to speaker after a graphic section
- **Text overlay: 5-10%.** Quick stats, names, single-word emphasis.
- **Speaker only: 5-15%.** Rare. Only genuine emotional moments.
- **B-roll: 0-10%.** Only when concrete visual reference is available.
- **No treatment 3+ times in a row.** Alternate energy levels.

### Zoom Cut Config

For each `zoom_cut` section:
```json
{
  "treatment": "zoom_cut",
  "zoomConfig": {
    "scale": 1.3,
    "faceCenter": { "x": 0.5, "y": 0.35 },
    "transition": "instant"
  }
}
```
- `scale`: 1.2 (subtle) to 1.4 (dramatic). Default 1.3.
- `faceCenter`: Speaker face position. Read `/workspace/docs/speaker-grid.json` if available. Default `{ x: 0.5, y: 0.35 }`.
- Duration: 3-8 seconds. Not too short (jarring) or too long (loses punch-in effect).
```

- [ ] **Step 3: Add structured visual description format**

Find the scene description section and add/replace with:

```markdown
## VISUAL DESCRIPTION FORMAT (MANDATORY for animation sections)

Every `animation` section MUST have a structured `visual` object:

```json
{
  "visual": {
    "primary": "The main element. Include: what it is, size (e.g. '80px bold'), position (e.g. 'centered'), color.",
    "secondary": "Supporting elements. Include: quantity, arrangement, behavior (e.g. '3 icons staggered left-to-right').",
    "background": "NEVER 'solid dark'. Specify: gradient (direction + 2 colors) OR pattern OR animated shapes.",
    "density": "low | medium | high",
    "fillPercent": 80
  }
}
```

### Rules
- `fillPercent` MUST be ≥ 70. The Verifier rejects scenes with large empty voids.
- `background` MUST NOT be a flat solid color. Use: `"radial gradient #0a0e27 center to #1a2e4a edges"`.
- `primary` text MUST specify font size ≥ 60px for titles, ≥ 36px for body.
- `density: "high"` = 4+ elements. `"medium"` = 3 elements. `"low"` = 2 (minimum accepted).
- Be SPECIFIC and VIVID. The Animator will implement exactly what you describe.
  - BAD: "Text about the problem"
  - GOOD: "80px bold white 'THE STRUGGLE IS REAL' centered, with red strikethrough line animating left-to-right across each word, 3 pain-point icons (🏊 ⏱️ 😤) staggered below at 40px"
```

- [ ] **Step 4: Add music mood specification**

Add at the end of the format section:

```markdown
## MUSIC MOOD

At the top level of scenes.json, specify background music direction:

```json
{
  "musicMood": {
    "genre": "electronic | ambient | acoustic | cinematic | hip-hop | lo-fi",
    "tempo": "slow | medium | fast",
    "energy": "calm | building | energetic | dramatic"
  }
}
```

Match to content type:
- Tutorial → lo-fi, medium, calm
- Podcast → acoustic, slow, calm
- Keynote → cinematic, medium, building
- Vlog → acoustic, medium, energetic
- Presentation → ambient, medium, calm
```

- [ ] **Step 5: Rewrite output format to scenes.json v3**

Replace the existing output format section with:

```markdown
## OUTPUT: scenes.json v3

Write `/workspace/scenes.json` with this structure:

```json
{
  "version": 3,
  "fps": {{FPS}},
  "totalFrames": <computed>,
  "musicMood": { "genre": "...", "tempo": "...", "energy": "..." },
  "sections": [
    {
      "name": "<PascalCase descriptive name>",
      "frames": [<startFrame>, <endFrame>],
      "treatment": "animation | zoom_cut | text_overlay | b_roll | speaker_only",

      // Animation-only fields:
      "sceneFile": "<PascalCaseName>",
      "layout": "stacked | fullscreen | overlay",
      "displayMode": "default | fullscreen | overlay",
      "layoutProps": { "splitRatio": 55, "position": "video-bottom" },
      "visual": { "primary": "...", "secondary": "...", "background": "...", "density": "high", "fillPercent": 80 },
      "syncPoints": [{ "frame": <offset from section start>, "action": "..." }],
      "enter": { "type": "crossfade", "durationMs": 300 },
      "exit": { "type": "crossfade", "durationMs": 300 },

      // Zoom cut-only fields:
      "zoomConfig": { "scale": 1.3, "faceCenter": { "x": 0.5, "y": 0.35 }, "transition": "instant" },

      // Text overlay-only fields:
      "textContent": "THE KEY STAT",
      "textStyle": { "fontSize": 72, "fontWeight": 800, "color": "#FFFFFF" },

      // B-roll-only fields:
      "brollQuery": "swimming pool lanes aerial"
    }
  ]
}
```

Field presence rules:
- `sceneFile`, `visual`, `syncPoints`, `enter`, `exit`, `layout`, `layoutProps` → ONLY for `animation`
- `zoomConfig` → ONLY for `zoom_cut`
- `textContent`, `textStyle` → ONLY for `text_overlay`
- `brollQuery` → ONLY for `b_roll`
- `name` and `frames` → ALWAYS present on ALL sections
```

- [ ] **Step 6: Update validation rules**

Add to the existing validation checklist:

```markdown
### Additional Validation (v3)

- [ ] Zoom cuts: ≥ 3 per 60 seconds of video
- [ ] Zoom cut duration: 3-8 seconds each (90-240 frames at 30fps)
- [ ] No two zoom cuts adjacent (≥ 1 non-zoom section between them)
- [ ] Treatment variety: no same treatment 3+ times in a row
- [ ] Every animation section has `visual.fillPercent` ≥ 70
- [ ] Every animation section has structured `visual` (not just a string)
- [ ] Music mood specified at top level
- [ ] Sections cover full video duration (no gaps, no overlaps)
```

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/prompts/planner-system.md
git commit -m "feat(sandbox): rewrite planner as full editorial planner — zoom cuts, B-roll, music, visual density"
```

---

### Task 5: Add visual density standards to animator-system.md

**Files:**
- Modify: `packages/sandbox/src/prompts/animator-system.md` (1264 lines — targeted additions)

- [ ] **Step 1: Read the animator prompt header to find insertion point**

Read `packages/sandbox/src/prompts/animator-system.md` lines 1-50 to find the main heading structure. Look for the section about code style or scene requirements.

- [ ] **Step 2: Add visual density standards section**

Insert after the existing code style / scene creation rules section:

```markdown
## VISUAL DENSITY STANDARDS (MANDATORY)

The Verifier will reject scenes that fail these checks. Design every scene to FILL the canvas.

### Canvas Fill ≥ 70%
At least 70% of the effective canvas area must contain visual content. No large empty dark voids. If you have a title, ADD supporting elements: background gradient, decorative shapes, icons, patterns.

### Element Count ≥ 3
Every scene needs at minimum:
1. **Primary element** — title, diagram, data viz, illustration
2. **Secondary element** — icon, shape, supporting text, decorative line, accent
3. **Background treatment** — gradient, pattern, animated shapes, noise texture

A scene with ONE line of text on a dark background is REJECTED.

### Font Sizing
- Title text: ≥ 60px (at 1080px width)
- Body text: ≥ 36px
- Stat/number callouts: ≥ 80px
- Must be readable at phone-screen size

### Color
- Use ≥ 2 colors beyond the background
- Never pure white (#FFFFFF) on pure black (#000000). Use near-black (#0a0e27) with gradients.
- Follow the plan's visual.primary/secondary color guidance

### Background (NEVER flat solid)
Every scene background must be:
- Radial or linear gradient (2+ color stops), OR
- Subtle pattern (dots, grid lines, noise), OR
- Animated shapes (floating particles, pulsing circles), OR
- Combination of the above

### Variety Across Scenes
No two adjacent scenes may use the same primary technique:
- Kinetic typography → Animated diagram
- Icon + text card → Data visualization
- Process flow → Comparison layout
- Full-bleed typography → Illustrated scene
```

- [ ] **Step 3: Add overlay scene rules**

Search for existing display mode guidance in the animator prompt. Add or strengthen:

```markdown
## OVERLAY SCENES (displayMode: "overlay")

Overlay scenes render ON TOP of the fullscreen speaker video. The speaker must remain visible.

1. **Transparent background**: Root `<AbsoluteFill>` MUST use `backgroundColor: 'transparent'`. NO solid colors. NO opaque gradients. The speaker shows through.

2. **Safe zones only**:
   - Top strip: Y 0% to 15% — short labels, small icons
   - Lower third: Y 58% to 85% — primary content zone
   - SPEAKER ZONE: Y 15% to 58% — **OFF LIMITS** (face area)
   - Subtitle area: Y 85% to 100% — reserved for captions

3. **Lightweight**: Max 2 elements visible at once. 1-3 words per text element. Use semi-transparent pills behind text: `rgba(0,0,0,0.6)` with `borderRadius: 8`.

4. **No large shapes**: Nothing wider than 60% of canvas or taller than 20% of canvas.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/animator-system.md
git commit -m "feat(sandbox): add visual density standards and overlay rules to animator prompt"
```

---

### Task 6: Expand verifier-system.md

**Files:**
- Modify: `packages/sandbox/src/prompts/verifier-system.md` (87 lines)

- [ ] **Step 1: Read the current verifier prompt**

Read `packages/sandbox/src/prompts/verifier-system.md` fully (87 lines).

- [ ] **Step 2: Add visual density checks to per-scene review**

After the existing "What to Check" items, add:

```markdown
### Visual Density (CRITICAL)
- Canvas fill: Is ≥70% of the canvas area filled with visual content? Large empty dark voids → FAIL.
- Element count: Does the scene have ≥3 distinct elements (primary + secondary + background)? Bare text on solid background → FAIL.
- Font size: Is primary text large and bold? Tiny text that's unreadable on a phone → FAIL.
- Background: Is it a flat solid color? If yes → FAIL. Must be gradient, pattern, or animated.
- Be specific in feedback: "Lower 60% of canvas is empty dark space — add background gradient and supporting icons" not just "sparse visuals."

### Overlay Compliance (for overlay displayMode)
- Background transparent? If you see a solid background covering the speaker → FAIL.
- Content in safe zones only (0-15% top, 58-85% lower third)? If content covers the face area → FAIL.
```

- [ ] **Step 3: Add full-composition review section**

Append to the end of the file:

```markdown
## FULL COMPOSITION REVIEW (dispatched after all scenes complete)

When the orchestrator dispatches you for full-composition review, render stills at 5 timestamps evenly spaced across the video.

For each still, score 1-5 on:
1. **Speaker framing** — Face visible, not cropped? Properly positioned in stacked mode?
2. **Visual richness** — Scene content fills the frame? No empty voids?
3. **Layout variety** — Are different scenes using different display modes and techniques?
4. **Text readability** — Can all text be read at phone-screen size?
5. **Overall cohesion** — Does video + graphics + captions look like one professional edit?

Report:
- Score per still (1-5 for each criterion)
- Average across all stills
- Specific issues for any still scoring < 3

If average < 3.0, flag for rework with specific scene IDs and issues.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/verifier-system.md
git commit -m "feat(sandbox): add visual density checks and full composition review to verifier"
```

---

## Chunk 3: Orchestrator Integration

### Task 7: Register Editor + Sound Designer in orchestrator

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:91-100,121-186`

- [ ] **Step 1: Read current prompt loading**

Read `packages/sandbox/src/orchestrator.ts` lines 87-100. Currently loads 7 prompts in a Promise.all.

- [ ] **Step 2: Add Editor + Sound Designer prompt loading**

Replace lines 91-100:
```typescript
const [orchestratorPrompt, animatorPrompt, researcherPrompt, trimmerPrompt, plannerPrompt, verifierPrompt, healerPrompt, editorPrompt, soundDesignerPrompt] =
    await Promise.all([
      loadPrompt('orchestrator-system'),
      loadPromptWithShared('animator-system'),
      loadPrompt('researcher-system'),
      loadPrompt('trimmer-system'),
      loadPromptWithShared('planner-system'),
      loadPromptWithShared('verifier-system'),
      loadPrompt('healer-system'),
      loadPrompt('editor-system'),
      loadPrompt('sound-designer-system'),
    ]);
```

- [ ] **Step 3: Register new subagent definitions**

Read lines 121-186 (agents object). After the `healer` subagent (around line 185), add:

```typescript
      editor: {
        description: 'Executes rough cut: applies zoom cuts via video splits + crop changes, trims silence, places B-roll items. Works only via manifest tools.',
        prompt: injectContext(editorPrompt, ctx),
        tools: [
          'Read', 'Bash', 'Grep',
          ...MANIFEST_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
      'sound-designer': {
        description: 'Selects background music, places sound effects at transitions, adjusts audio levels. Works via manifest and asset tools.',
        prompt: injectContext(soundDesignerPrompt, ctx),
        tools: [
          'Read', 'Write', 'Bash', 'WebSearch', 'WebFetch',
          ...MANIFEST_TOOL_NAMES,
          ...ASSET_TOOL_NAMES,
        ],
        model: 'sonnet',
      },
```

- [ ] **Step 4: Type check**

Run: `cd packages/sandbox && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/orchestrator.ts
git commit -m "feat(sandbox): register Editor and Sound Designer agents in orchestrator"
```

---

### Task 8: Rewrite orchestrator-system.md — 7-phase pipeline

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md` (659 lines)

This is the master control prompt. It coordinates all 8 agents across 7 phases.

- [ ] **Step 1: Read current orchestrator-system.md structure**

Read `packages/sandbox/src/prompts/orchestrator-system.md` fully (659 lines). Map:
- Lines 1-50: Role, context, personality, streaming (KEEP as-is)
- Lines 53-169: Phase 1-4 (REWRITE to 7 phases)
- Lines 182-216: Content type, treatment selection (KEEP, update treatment table)
- Lines 291-398: Subagent dispatch rules (ADD Editor + Sound Designer)
- Lines 400-462: Tool tables (KEEP, add audio tools note)
- Lines 464-564: Quality standards (ADD zoom cut cadence)
- Lines 566-659: Skill loading, flow summary (UPDATE)

- [ ] **Step 2: Rewrite FLOW PHASES to 7 phases**

Replace the Phase 1-4 section (lines 53-169) with:

```markdown
## FLOW PHASES

The orchestrator operates in seven phases. Use thinking to determine which phase applies.

### Phase 1: Understanding (Chat)
Conversational discovery. Same as before — understand what the user wants.
- On first message: friendly greeting + ask for their vision (1-2 sentences).
- If user already described what they want: skip to Phase 2.
- If user says "just do it": proceed with your creative judgment.

### Phase 2: Planning
Analyze source material and create a comprehensive edit plan.

1. Detect content type (tutorial, podcast, interview, vlog, presentation, keynote).
2. Dispatch **planner** subagent with transcript path, user brief, canvas dimensions, head tracking data.
3. Planner produces `/workspace/scenes.json` (v3) + `/workspace/docs/SCENE_PLAN.md`.
4. Read `scenes.json`. Validate:
   - Frame coverage (no gaps, no overlaps)
   - Duration bounds (animation: 210-450 frames, zoom_cut: 90-240 frames)
   - Treatment variety (no same treatment 3x in a row)
   - Zoom cuts ≥3 per 60s, display mode distribution (70%+ stacked)
   - Fix violations directly — don't re-dispatch Planner for minor issues.
5. Show plan via `scene_plan` widget. Include section list with treatments, music mood, and scene plan markdown.
6. **STOP.** Wait for user approval.

### Phase 3: Rough Cut
The Editor handles all video-level edits before motion graphics.

1. Dispatch **editor** subagent with:
   - The plan's `sections` filtered to `treatment: "zoom_cut"` and `treatment: "trim"`
   - Face position data from `/workspace/docs/speaker-grid.json` (if exists)
2. In parallel: dispatch **researcher** for any `treatment: "b_roll"` sections (search queries from `brollQuery`).
3. After Editor completes: verify video track integrity (read manifest, check no gaps/overlaps).
4. After Researcher completes: Editor places B-roll items (or orchestrator adds them directly via manifest tools).
5. For `treatment: "text_overlay"` sections: add text items directly via `mcp__manifest__add_item` with the plan's textContent and textStyle. Use transform for positioning and keyframes for fade-in/fade-out.
6. Progress: 10% → 30%.

### Phase 4: Motion Graphics
Create manifest skeleton, then dispatch Motion Designers per scene.

1. **Create overlay track**: `mcp__manifest__add_track` type "overlay", name "Visuals".
2. **Create scene items** for every `treatment: "animation"` section:
   ```json
   {
     "type": "scene", "trackId": "<overlay-track-id>",
     "startMs": "<frames[0] / fps * 1000>",
     "endMs": "<frames[1] / fps * 1000>",
     "data": {
       "sceneFile": "<section.sceneFile>",
       "displayMode": "<section.displayMode>",
       "enter": <section.enter>,
       "exit": <section.exit>,
       "layoutProps": <section.layoutProps>
     }
   }
   ```
3. **Dispatch animator per scene** (sequentially). In dispatch message include:
   - The section's full `visual` object (primary, secondary, background, density, fillPercent)
   - Effective dimensions for the display mode
   - Sync points with frame offsets and actions
   - "Visual density fillPercent must be ≥ [value]"
4. **Verify each scene**: dispatch verifier → healer if failed (max 2 retries).
5. **Final tsc check**: `tsc --noEmit --pretty false`. Healer if errors.
6. Progress: 30% → 80%.

### Phase 5: Sound Design
1. Dispatch **sound-designer** with:
   - `musicMood` from the plan
   - Scene transition timestamps (startMs of each scene item from manifest)
   - Video duration
2. Sound Designer adds background music + optional SFX via manifest tools.
3. Progress: 80% → 90%.

### Phase 6: Polish & Verify
1. Configure caption style via `mcp__manifest__update_caption_style` (match content type + theme).
2. Dispatch **verifier** for full-composition review (5 stills across video).
3. If average score < 3.0: identify worst scenes, re-dispatch animator with verifier feedback.
4. Render 2-3 final preview stills for the user.
5. Progress: 90% → 100%.

### Phase 7: Refinement
Iterative edits after initial generation. Same as current Phase 4:
- Small changes (timing, reordering): manifest tools directly.
- Visual content changes: re-dispatch animator for that section.
- Never re-plan entire project for a single-section tweak.
```

- [ ] **Step 3: Add Editor + Sound Designer dispatch rules**

In the SUBAGENT DISPATCH RULES section (around line 291), add:

```markdown
### Editor (Phase 3: rough cut)

Dispatch after plan approval. Provide:
- The plan's sections filtered to `treatment: "zoom_cut"` and `treatment: "trim"` (as JSON)
- Face position data: read `/workspace/docs/speaker-grid.json` and include faceCenter coordinates
- "Process zoom cuts in REVERSE chronological order"

The Editor uses manifest tools only (split_video, update_item, remove_item). After it finishes, read the manifest and verify video track integrity — no gaps, no overlapping items.

### Sound Designer (Phase 5: audio)

Dispatch after Phase 4 motion graphics are complete. Provide:
- `musicMood` from the plan (genre, tempo, energy)
- Array of scene transition timestamps: extract startMs from each scene item in manifest
- Total video duration in milliseconds
- "Music volume must be 0.12-0.25, well below dialogue"

The Sound Designer adds audio tracks via manifest tools.
```

- [ ] **Step 4: Add zoom cut quality standard**

In the QUALITY STANDARDS section (around line 486), add:

```markdown
### Zoom Cut Cadence (CRITICAL)

Zoom cuts (punch-ins) are the #1 technique for making single-camera talking-head footage feel dynamic. Every video MUST have them.

- At least 3-4 zoom cuts per 60 seconds of video
- Zoom scale: 1.2x to 1.4x (never below 1.15 — too subtle)
- Duration: 3-8 seconds per zoom cut
- Never two zoom cuts adjacent — need ≥1 non-zoom section between them
- Place at: speaker emphasis, statistics, emotional peaks, topic transitions

### Visual Density (CRITICAL)

Every animation scene must fill the frame:
- ≥ 70% canvas fill (no empty dark voids)
- ≥ 3 visual elements (primary + secondary + background treatment)
- No flat solid backgrounds — gradients, patterns, or animated shapes required
- Primary text ≥ 60px, readable at phone-screen size
```

- [ ] **Step 5: Update the flow summary diagram**

Update the flow summary at the end to show 7 phases with all 8 agents.

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat(sandbox): rewrite orchestrator — 7-phase pipeline, 8 agents, zoom cuts, sound design"
```

---

## Chunk 4: Integration Test

### Task 9: Build verification and smoke test

- [ ] **Step 1: Build the sandbox package**

Run: `cd packages/sandbox && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify all 9 prompts load**

```bash
cd packages/sandbox && node --input-type=module -e "
import { loadPrompt, loadPromptWithShared } from './dist/prompts/prompt-loader.js';
const prompts = [
  ['orchestrator-system', false],
  ['animator-system', true],
  ['researcher-system', false],
  ['trimmer-system', false],
  ['planner-system', true],
  ['verifier-system', true],
  ['healer-system', false],
  ['editor-system', false],
  ['sound-designer-system', false],
];
for (const [name, shared] of prompts) {
  try {
    const content = shared ? await loadPromptWithShared(name) : await loadPrompt(name);
    console.log(name + ': ' + content.length + ' chars ✓');
  } catch (e) {
    console.log(name + ': FAILED — ' + e.message);
  }
}
"
```
Expected: All 9 prompts loaded with character counts. No FAILED entries.

- [ ] **Step 3: Verify orchestrator builds with 8 agents**

```bash
cd packages/sandbox && node --input-type=module -e "
import { buildOrchestratorOptions } from './dist/orchestrator.js';
const ctx = { canvasWidth: 1080, canvasHeight: 1920, fps: 30, durationMs: 60000, hasTranscript: true };
const opts = await buildOrchestratorOptions(ctx);
const agents = Object.keys(opts.agents);
console.log('Agents (' + agents.length + '):', agents.join(', '));
console.log('Tools:', opts.allowedTools.length);
console.log(agents.length === 8 ? '✓ All 8 agents registered' : '✗ Expected 8 agents, got ' + agents.length);
"
```
Expected: 8 agents: animator, researcher, trimmer, planner, verifier, healer, editor, sound-designer.

- [ ] **Step 4: Type check all packages**

Run:
```bash
cd packages/shared && npx tsc --noEmit && echo "shared: ✓" && cd ../sandbox && npx tsc --noEmit && echo "sandbox: ✓"
```
Expected: Both pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git status
git commit -m "feat(sandbox): complete professional edit pipeline — 8 agents, 7 phases, zoom cuts, sound design"
```

---

## Summary

| Chunk | Tasks | What It Delivers |
|-------|-------|-----------------|
| 1: Schema & Agents | 1-3 | Manifest schema for scene transitions/layout, Editor prompt, Sound Designer prompt |
| 2: Planner & Animator | 4-6 | Editorial Planner (zoom cuts, B-roll, music, density), visual density standards, expanded Verifier |
| 3: Orchestrator | 7-8 | 8-agent registration, 7-phase pipeline orchestration prompt |
| 4: Integration Test | 9 | Build, prompt loading, agent count verification |

**Key principle:** The manifest + Remotion template already support everything (crop, transforms, keyframes, display modes, transitions, audio). This plan makes the AGENTS smart enough to use those capabilities correctly and creatively.

**After this plan:** Run the full pipeline against the MySwimPro trailer and compare rendered stills against the v2 output. Expected improvements: zoom cuts creating visual variety, dense motion graphics filling the canvas, background music, varied display modes, properly framed speaker.
