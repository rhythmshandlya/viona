# Professional Edit Pipeline — Multi-Agent Architecture

## Problem

The current pipeline generates sparse, generic motion graphics overlaid on an untouched video. The rendered output from a test run (MySwimPro trailer, 79s) shows:

1. **Empty visuals**: 7/8 scenes are tiny text floating in vast dark voids. Professional motion graphics fill the frame.
2. **No video editing**: The source video plays uncut — no zoom cuts, no silence trimming, no pacing adjustments. Professional edits use punch-ins every 3-5 seconds.
3. **Face cropping**: Stacked mode clips the speaker's head because `SpeakerVideo.tsx` centers the video vertically, but talking-head footage has the face in the upper third.
4. **Same layout every scene**: 7/8 scenes use identical stacked splits. Professional edits vary between stacked, fullscreen, overlay, zoom cuts, and speaker-only moments.
5. **No audio design**: No background music, no sound effects at transitions, no audio mixing.
6. **No captions on output**: Captions exist in the manifest but aren't styled or verified.
7. **Hardcoded split ratio**: `PlayerComposition.tsx:69` hardcodes `ratio: 55` — the Planner's layout decisions don't flow to rendering.

The gap between current output and "professional edited video" is not prompt-tuning — it's architectural. The pipeline needs new agents, new phases, and rendering fixes.

---

## Goal

**Input:** A talking-head video (any length, any topic) + optional creative brief.
**Output:** A professionally edited video with zoom cuts, motion graphics, B-roll, captions, background music, and sound effects — indistinguishable from work by a skilled human editor.

---

## What "Professional" Means (Research-Backed)

Professional talking-head editing follows 6 phases (per No Film School, 35mm Studio, industry standard):

| Phase | What Happens | Current Support |
|-------|-------------|-----------------|
| **1. Rough Cut** | Cut dead air, filler words, false starts. Tighten pacing. | Trimmer exists but unused in practice |
| **2. Fine Cut** | Zoom cuts (20-30% punch-ins), jump cuts, B-roll insertions | **Missing entirely** |
| **3. Graphics** | Lower thirds, callout cards, data viz, animated titles, CTAs | Animator exists but output is sparse |
| **4. Color** | Grading for mood/brand | Out of scope (v2) |
| **5. Sound** | Background music, SFX at transitions, audio normalization | **Missing entirely** |
| **6. Captions** | Word-by-word animated captions (85% watch on mute) | Exists but unstyled |

AI tools (Descript, OpusClip, Captions App) all implement phases 1-2 as their core — transcript-first editing with automatic zoom cuts and silence removal. Phases 3 and 5 are our differentiator.

**Key engagement rules** (from research on high-performing short-form):
- 3-second hook: 50-60% of viewers drop within 3 seconds
- Pattern interrupt every 3-5 seconds (zoom cut, text, B-roll, graphic)
- Captions mandatory (85% watch without sound)
- One visual change every 2-4 seconds minimum
- Pacing: never the same static frame for more than 5 seconds

---

## Agent Architecture

### Current Agents (6)

```
Orchestrator → { Planner, Animator, Researcher, Trimmer, Verifier, Healer }
```

### Proposed Agents (8)

```
Creative Director (Orchestrator)
  ├── Editorial Planner    — Plans the ENTIRE edit (scenes + cuts + zooms + B-roll + music)
  ├── Editor               — Executes rough/fine cut (zoom cuts, silence trim, B-roll placement)
  ├── Motion Designer      — Creates Remotion .tsx motion graphics (higher quality standards)
  ├── Researcher           — Fetches stock assets, screenshots, B-roll (unchanged)
  ├── Sound Designer       — Selects music, places SFX, mixes audio levels
  ├── Verifier             — Reviews full composition (expanded scope)
  └── Healer               — Fixes TypeScript errors (unchanged)
```

### Agent Detail

#### 1. Creative Director (Orchestrator) — Opus
**Existing:** `orchestrator.ts` + `orchestrator-system.md`
**Changes:** Updated phase flow (7 phases instead of 4), dispatch rules for new agents.

#### 2. Editorial Planner — Opus
**Existing:** `planner-system.md` (682 lines)
**Changes:** Major rewrite. Currently plans only motion graphics scenes. Must now plan:

- **Story arc**: Hook → Problem → Insight → Payoff → CTA (from transcript analysis)
- **Section breakdown**: Identify topic shifts, emotional peaks, data moments, personal asides
- **Treatment per section**: animation / zoom_cut / b_roll / text_overlay / speaker_only / trim
- **Zoom cut placement**: Mark specific words/moments for 1.3x punch-ins (at emphasis, data points, transitions)
- **Display mode**: stacked / fullscreen / overlay per section, with split ratio and position
- **Music mood**: tempo, genre, energy level (e.g., "upbeat electronic, 120bpm" or "ambient piano, reflective")
- **Pacing targets**: cuts-per-minute, visual change cadence
- **Scene descriptions**: Vivid, specific (current descriptions are too vague → spare visuals)

**Output format** — `scenes.json` v3:
```json
{
  "version": 3,
  "fps": 30,
  "totalFrames": 2377,
  "musicMood": { "genre": "electronic", "tempo": "medium", "energy": "building" },
  "sections": [
    {
      "name": "HookTitle",
      "frames": [0, 240],
      "treatment": "animation",
      "layout": "stacked",
      "layoutProps": { "splitRatio": 55, "position": "video-bottom" },
      "displayMode": "default",
      "sceneFile": "HookTitle",
      "visual": {
        "primary": "Full-width title 'YOUR FULL POTENTIAL' in 80px bold white, centered",
        "secondary": "Concentric ripple rings expanding outward from center, cyan #00D4FF",
        "background": "Deep navy radial gradient #0a0e27 → #1a1e3e",
        "density": "high",
        "fillPercent": 85
      },
      "syncPoints": [
        { "frame": 0, "action": "Title slams in from top with bounce spring" },
        { "frame": 45, "action": "Ripple rings begin expanding" },
        { "frame": 90, "action": "Subtitle fades up below title" }
      ],
      "enter": { "type": "fade", "durationMs": 300 },
      "exit": { "type": "crossfade", "durationMs": 300 }
    },
    {
      "name": "zoom_intro_emphasis",
      "frames": [240, 330],
      "treatment": "zoom_cut",
      "zoomConfig": {
        "scale": 1.3,
        "faceCenter": { "x": 0.5, "y": 0.35 },
        "transition": "instant"
      }
    },
    {
      "name": "PainPoints",
      "frames": [330, 630],
      "treatment": "animation",
      "layout": "stacked",
      "layoutProps": { "splitRatio": 55, "position": "video-bottom" },
      "displayMode": "default",
      "sceneFile": "PainPoints",
      "visual": {
        "primary": "Animated list: 'SLOW' and 'OUT OF BREATH' strike through in red, one at a time",
        "secondary": "Each pain point slides in from left with icon, then gets crossed out",
        "background": "Dark gradient with subtle red pulse on each strikethrough",
        "density": "high",
        "fillPercent": 80
      },
      "syncPoints": [
        { "frame": 0, "action": "First pain point slides in" },
        { "frame": 60, "action": "Red strikethrough animates across" },
        { "frame": 120, "action": "Second pain point slides in" },
        { "frame": 180, "action": "Second strikethrough" }
      ]
    }
  ]
}
```

Key differences from current `scenes.json` v2:
- `treatment` field differentiates animation vs zoom_cut vs b_roll vs text_overlay vs speaker_only
- `zoomConfig` for zoom cut sections (scale, face center position, transition style)
- `visual.density` and `visual.fillPercent` — quality minimums enforced
- `visual.primary/secondary/background` — structured scene description (not freeform string)
- `layoutProps.splitRatio` — per-section split ratio flows to rendering
- `musicMood` at top level — informs Sound Designer
- `sections` replaces `segments[].beats[]` — flat array, simpler

#### 3. Editor — Sonnet
**New agent.** Replaces the Trimmer. Executes the rough cut from the Planner's edit plan.

**Responsibilities:**
1. **Zoom cuts**: For each `treatment: "zoom_cut"` section:
   - Call `mcp__manifest__split_video` at the zoom-in point
   - Call `mcp__manifest__update_item` on the new segment: set `data.crop.scale` to the planned zoom level (e.g., 1.3) and `data.crop.y` to center on the speaker's face (using `zoomConfig.faceCenter.y` converted to 0-100 range)
   - Call `mcp__manifest__split_video` again at the zoom-out point
   - Call `mcp__manifest__update_item` to reset crop to `{ scale: 1.0, y: 50, x: 50 }`

2. **Silence trimming**: For each `treatment: "trim"` section:
   - Run `ffmpeg` silence detection on the audio
   - For silences > 500ms: trim to 300ms via `mcp__manifest__split_video` + adjust timing
   - Ripple-shift all subsequent items

3. **B-roll placement**: For each `treatment: "b_roll"` section:
   - After Researcher downloads the asset, add an image/video item on a B-roll track
   - Set timing from the plan's frame range

**Tools:** `Read`, `Write`, `Bash`, `Grep` + all manifest tools
**Model:** Sonnet (mechanical, well-specified tasks)

#### 4. Motion Designer — Opus
**Existing:** `animator-system.md` (62KB)
**Changes:** Add visual density standards to the prompt:

```markdown
## VISUAL DENSITY STANDARDS (MANDATORY)

Every scene MUST meet these minimums:

1. **Canvas fill**: At least 70% of the effective canvas area must contain visual content.
   No large empty voids. If the design has a title, add a background pattern, gradient, or
   supporting elements to fill the space.

2. **Element count**: Minimum 3 visual elements per scene (e.g., title + icon + background pattern).
   A scene with just one line of text is NOT acceptable.

3. **Font size**: Primary text must be at least 60px at 1080px width. Secondary text at least 36px.
   Text must be readable at a glance on a phone screen.

4. **Color variety**: Use at least 2 colors beyond background. The plan's `visual` field specifies
   a primary and secondary color layer — use both.

5. **Background treatment**: NEVER use a flat solid color background. Use gradients, patterns,
   subtle noise, or animated shapes. The background is 30-40% of the visual experience.

6. **Variety across scenes**: No two adjacent scenes may use the same visual technique.
   If Scene 1 uses kinetic typography, Scene 2 must use a different approach (diagram, card,
   illustration, data viz, etc.).
```

Also add overlay scene rules:
```markdown
## OVERLAY SCENES (displayMode: "overlay")

Overlay scenes render on TOP of the fullscreen speaker video. They MUST:
1. Use `transparent` or `rgba(0,0,0,0)` background — NO solid colors
2. Place content ONLY in safe zones: Y 0-15% (top strip) or Y 58-85% (lower third)
3. Keep content lightweight: max 2 elements, 1-3 words each
4. Use semi-transparent background pills behind text for readability
```

#### 5. Researcher — Sonnet (Unchanged)
Existing agent. Fetches stock photos, screenshots, B-roll via Unsplash/Pexels/Freepik APIs.

#### 6. Sound Designer — Sonnet
**New agent.** Handles all audio beyond the source video.

**Responsibilities:**
1. **Background music**: Based on `musicMood` from the plan:
   - Search royalty-free music library (via MCP or web search)
   - Download audio file to `/workspace/public/audio/`
   - Add audio item to manifest on a "Music" track
   - Set volume to 0.15-0.25 (well below dialogue)
   - Add fadeIn (2s) and fadeOut (3s)

2. **Sound effects**: At each scene transition:
   - Add subtle whoosh/transition SFX
   - Add emphasis hits at key reveals (data points, title reveals)
   - SFX volume: 0.3-0.5

3. **Audio ducking** (stretch goal):
   - Lower music volume during speaker emphasis moments
   - Raise during speaker_only gaps

**Tools:** `Read`, `Write`, `Bash`, `WebSearch`, `WebFetch` + manifest tools + asset tools
**Model:** Sonnet

**Music source options** (in order of preference):
- Freepik audio API (if key configured)
- Pixabay Music API (free, no key needed)
- Pre-bundled library in `/app/audio/` (ship 5-10 royalty-free tracks in Docker image)

#### 7. Verifier — Sonnet (Expanded)
**Existing:** `verifier-system.md` (88 lines)
**Changes:** Expand from per-scene verification to full-composition review:

```markdown
## FULL COMPOSITION REVIEW (after all scenes generated)

Render stills at 5 key timestamps spread across the video. For each still, check:

1. **Visual density**: Is the frame visually rich or mostly empty?
2. **Speaker visibility**: Is the speaker's face visible and properly framed?
3. **Text readability**: Can all text be read at phone-screen size?
4. **Layout correctness**: Does the display mode match the plan?
5. **Transition quality**: Does the transition between scenes look smooth?
6. **Overall composition**: Does video + graphics + captions look cohesive?

Score each still 1-5. If average < 3, flag specific issues for rework.
```

#### 8. Healer — Sonnet (Unchanged)
Existing agent. Fixes TypeScript compilation errors.

---

## Pipeline Phases

### Phase 1: Ingestion (Existing — `workspace-init.ts`)
- Download video to `/workspace/public/source.mp4`
- Write `transcript.json`, `user-brief.md`, `speaker-grid.json`
- Copy template files, install dependencies
- Initialize manifest with video + audio tracks

### Phase 2: Analysis & Planning
**Orchestrator actions:**
1. Detect content type from transcript
2. Dispatch **Editorial Planner** with:
   - Transcript path
   - User brief
   - Head tracking data (for face position → zoom cut targeting)
   - Canvas dimensions, FPS, duration
3. Planner produces `scenes.json` v3 + `SCENE_PLAN.md`
4. Orchestrator validates plan (frame coverage, duration bounds, display mode distribution)
5. Show plan to user via `scene_plan` widget
6. **STOP — wait for user approval**

### Phase 3: Rough Cut (NEW)
**Orchestrator actions:**
1. Dispatch **Editor** agent with the approved plan
2. Editor executes:
   - Zoom cuts: split video items + apply crop for each `zoom_cut` section
   - Silence trim: detect + remove dead air
   - B-roll slots: mark positions (Researcher fills them)
3. In parallel: dispatch **Researcher** for B-roll and screenshot sections
4. After Editor + Researcher complete: manifest has a well-paced base edit
5. Progress: 10% → 30%

### Phase 4: Motion Graphics (Improved)
**Orchestrator actions:**
1. Create manifest skeleton: add overlay track, create scene items for all `animation` sections
2. For each animation section, sequentially:
   a. Dispatch **Motion Designer** with effective dimensions, visual description, sync points
   b. Trigger rebuild
   c. Dispatch **Verifier** for per-scene check
   d. If failed → dispatch **Healer** → re-verify (max 2 retries)
3. After all scenes: run `tsc --noEmit` → Healer if needed
4. Progress: 30% → 80%

### Phase 5: Sound Design (NEW)
**Orchestrator actions:**
1. Dispatch **Sound Designer** with:
   - `musicMood` from the plan
   - Scene transition timestamps (for SFX placement)
   - Video duration
2. Sound Designer:
   - Downloads music track → adds to manifest
   - Adds SFX at transitions → adds to manifest
   - Sets volume levels
3. Progress: 80% → 90%

### Phase 6: Polish & Verify
**Orchestrator actions:**
1. Configure caption style based on plan and theme
2. Dispatch **Verifier** for full-composition review (5 stills across video)
3. If issues found → targeted fixes (re-dispatch affected agents)
4. Render final preview stills
5. Report completion to user
6. Progress: 90% → 100%

### Phase 7: Refinement
Conversational edits — same as current Phase 4.

---

## Rendering Fixes Required

### Fix 1: Face-Aware Video Cropping
**File:** `packages/sandbox/template/src/composition/SpeakerVideo.tsx`
**Problem:** `objectFit: 'cover'` centers the video vertically, but talking-head footage has the face in the upper third. Stacked mode clips the head.
**Fix:**
```tsx
// Add objectPosition prop based on head tracking data
const videoStyle: CSSProperties = {
  ...existing,
  objectPosition: crop?.faceY
    ? `center ${crop.faceY}%`
    : 'center 30%', // Default: favor upper portion (face area)
};
```
The `30%` default keeps the face visible for most talking-head footage. When head tracking data is available, use the precise face Y position.

### Fix 2: Dynamic Split Ratio
**File:** `packages/sandbox/template/src/PlayerComposition.tsx`
**Problem:** Line 69 hardcodes `splitSettings: { ratio: 55 }`. The Planner's `layoutProps.splitRatio` is ignored.
**Fix:**
```tsx
// In buildLayoutProps(), read splitRatio from scene item data
const splitRatio = sceneItem.data?.layoutProps?.splitRatio ?? 55;
// Pass to FullComposition per-segment instead of a single global value
```
This requires extending `LayoutSegment` to carry per-segment split settings, and updating `getRectsForMode()` to use them instead of a single global `SplitSettings`.

### Fix 3: Transparent Overlay Backgrounds
**File:** Animator prompt enforcement + Verifier validation
**Problem:** Overlay scenes render with solid dark backgrounds, hiding the speaker video behind them.
**Fix:**
- Animator prompt: overlay scenes MUST use `backgroundColor: 'transparent'` on `<AbsoluteFill>`
- Verifier: check that overlay scene files don't contain solid background colors
- Scene template: add a guard in the overlay scene boilerplate

### Fix 4: Scene Data Schema Extension
**File:** `packages/shared/src/manifest-v2.ts`
**Problem:** `sceneItemDataV2Schema` only has `{ sceneFile: string }`. DisplayMode, transitions, and layout props are added at runtime but not validated.
**Fix:**
```typescript
export const sceneItemDataV2Schema = z.object({
  sceneFile: z.string(),
  displayMode: z.enum(['default', 'fullscreen', 'overlay']).default('default'),
  enter: z.object({
    type: z.enum(['cut', 'crossfade', 'fade', 'slide-left', 'slide-up', 'zoom', 'morph']),
    durationMs: z.number().min(0).max(1000),
  }).optional(),
  exit: z.object({
    type: z.enum(['cut', 'crossfade', 'fade', 'slide-left', 'slide-up', 'zoom', 'morph']),
    durationMs: z.number().min(0).max(1000),
  }).optional(),
  layoutProps: z.object({
    splitRatio: z.number().min(30).max(70).default(55),
    position: z.enum(['video-bottom', 'video-top']).default('video-bottom'),
  }).optional(),
});
```

### Fix 5: Zoom Cut Rendering
**File:** `packages/sandbox/template/src/items/VideoItem.tsx`
**Problem:** Video items support `data.crop: { x, y, scale }` but need smooth transitions between zoom levels.
**Fix:** The zoom cuts use `split_video` to create discrete segments with different crop values. The existing crop rendering already works — no code change needed. The crop `y` value positions the frame vertically (0 = top, 100 = bottom), and `scale` controls zoom level. Instant cuts between segments create the jump-cut style punch-in effect used by professional editors.

The Editor agent executes:
```
1. split_video at zoom-in timestamp → [segment_A, segment_B]
2. update_item segment_B: data.crop = { x: 50, y: 35, scale: 1.3 }
3. split_video segment_B at zoom-out timestamp → [segment_B, segment_C]
4. update_item segment_C: data.crop = { x: 50, y: 50, scale: 1.0 }
```

---

## Prompt Changes Summary

| File | Change |
|------|--------|
| `orchestrator-system.md` | 7-phase flow, new agent dispatch rules, zoom cut planning |
| `planner-system.md` | Complete rewrite — plan entire edit, not just scenes. scenes.json v3 format. |
| `animator-system.md` | Add visual density standards, overlay transparency rules |
| `verifier-system.md` | Add full-composition review, visual density scoring |
| NEW `editor-system.md` | Rough cut execution: zoom cuts, silence trim, B-roll placement |
| NEW `sound-designer-system.md` | Music selection, SFX placement, audio mixing |
| `healer-system.md` | Unchanged |
| `researcher-system.md` | Unchanged |

## Orchestrator Code Changes

| File | Change |
|------|--------|
| `orchestrator.ts` | Register Editor + Sound Designer subagents, load new prompts |
| `mcp-servers.ts` | Add audio MCP server (if needed for music library) |
| `mcp-config.ts` | Add music/SFX asset server config |
| `prompt-loader.ts` | Add editor, sound-designer to prompt loading |
| `workspace-init.ts` | Copy pre-bundled audio assets, write face position data |

## Manifest Schema Changes

| File | Change |
|------|--------|
| `packages/shared/src/manifest-v2.ts` | Extend sceneItemDataV2Schema with displayMode, transitions, layoutProps |

## Template Rendering Changes

| File | Change |
|------|--------|
| `PlayerComposition.tsx` | Read per-scene splitRatio from manifest data |
| `SpeakerVideo.tsx` | Add face-aware objectPosition (default to upper third) |
| `composition/utils.ts` | Accept per-segment split settings in getRectsForMode() |

---

## Execution Priority

### P0 — Critical (without these, output isn't "professional")
1. **Editorial Planner rewrite** — plans zoom cuts, varied layouts, rich visual descriptions
2. **Editor agent** — executes zoom cuts via manifest split_video + crop
3. **Face-aware video cropping** — SpeakerVideo objectPosition fix
4. **Visual density standards in Animator** — no more empty scenes
5. **Dynamic split ratio** — Planner decisions flow to rendering

### P1 — Important (significant quality improvement)
6. **Sound Designer agent** — background music + SFX
7. **Scene data schema extension** — validates displayMode, transitions, layoutProps
8. **Transparent overlay enforcement** — prompt + verifier validation
9. **Full-composition Verifier** — reviews complete output, not just per-scene

### P2 — Nice to Have (polish)
10. **Caption styling agent** — style captions per content type
11. **B-roll via Researcher** — stock footage for context sections
12. **Audio ducking** — dynamic music volume during speech
13. **Transition SFX sync** — whooshes aligned with visual transitions

---

## Success Criteria

A pipeline run on a 60-90 second talking-head video should produce:

1. **Zoom cuts**: At least 3-4 punch-in zoom cuts placed at emphasis moments
2. **Motion graphics**: At least 60% of the video has overlay/stacked graphics, visually rich (>70% canvas fill)
3. **Varied layouts**: Mix of stacked (60-70%), overlay (15-20%), fullscreen (1-2 moments), zoom cuts (10-15%)
4. **Background music**: Appropriate genre/energy, well below dialogue level
5. **Captions**: Styled, animated, visible throughout
6. **Pacing**: No static frame for more than 5 seconds, visual change cadence of 2-4 seconds
7. **Speaker visibility**: Face properly framed and visible in 80%+ of the video
8. **Silence trimmed**: Dead air > 500ms shortened, filler words optionally removed
9. **Professional quality**: Output indistinguishable from a skilled human editor's work at first glance

---

## Testing

Test against the same MySwimPro trailer (79s) that exposed current quality issues. Render stills at 8 timestamps and compare against the v2 output:

| Timestamp | v2 Issue | Expected v3 |
|-----------|----------|-------------|
| 0:03 (hook) | Sparse "FULL POTENTIAL" text | Bold title filling 80%+ of visual area, gradient bg |
| 0:10 | No zoom cut | Zoomed-in speaker (1.3x) for emphasis |
| 0:20 | Tiny "STRUGGLE IS REAL" in void | Animated pain point list with icons, fills frame |
| 0:30 | Speaker head cropped | Face visible and properly positioned |
| 0:40 | Same stacked layout again | Different layout — overlay or fullscreen moment |
| 0:50 | No audio design | Background music audible in full render |
| 1:00 | Empty lower half | Rich graphics with shapes, gradients, animation |
| 1:15 | No pacing variety | Mix of zoom cuts, graphics, speaker-only |
