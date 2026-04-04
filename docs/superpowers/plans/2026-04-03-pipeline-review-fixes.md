# Pipeline Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 16 issues (6 Critical, 10 Important) found in the end-to-end pipeline prompt review — stale examples, wrong coordinate formulas, old track names, contradictory rules, and dead code.

**Architecture:** All changes are prompt/doc edits except one TypeScript cleanup. No runtime code changes. The largest single item is rewriting the Layout Editor's good-layout.md example to demonstrate the V0-V4 architecture. Issues are grouped by file to minimize context-switching.

**Tech Stack:** Markdown prompts, XML shared modules, TypeScript (prompt-loader.ts)

---

### Task 1: Fix Setup Agent — remove stale manifest read rule, fix track names, fix SVG reference

**Files:**
- Modify: `packages/sandbox/src/prompts/setup-agent/system.md`

- [ ] **Step 1: Remove rule #3 (reads manifest data that doesn't exist yet)**

The Setup Agent runs in Phase 4, but the Layout Editor (which writes speaker data to the manifest) runs in Phase 6. Rule #3 tells the agent to read nonexistent data.

Find and replace rule #3 (around line 368):

```markdown
3. **Read the manifest THIRD** — call `read_manifest` to get scene items with speaker spatial data. For each overlay scene, extract `data.speakerBbox`, `data.speakerCenter`, and `data.visibleZones` from the matching scene item. These values were written by the Layout Editor.
```

Replace with:

```markdown
3. **Write placeholder SPEAKER constants** — for overlay scene skeletons, include placeholder SPEAKER and VISIBLE_ZONES constants using the default values documented below. The Layout Editor will overwrite these with real matte-derived values in a later phase.
```

- [ ] **Step 2: Fix old track name references in overlay skeleton comments**

Find (around line 335-336):

```
  // - BehindSpeaker: elements render behind the person (on scene-bg track)
  // - InFrontOfSpeaker: elements render in front of the person (on scene-fg track)
```

Replace with:

```
  // - BehindSpeaker: elements render behind the person (on V2 track)
  // - InFrontOfSpeaker: elements render in front of the person (on V4 track)
```

- [ ] **Step 3: Fix "SVG paths" reference in anti-card rule**

Find (around line 376):

```
Animators must build scene-specific visuals (SVG paths, charts, kinetic typography, node graphs, etc.).
```

Replace with:

```
Animators must build scene-specific visuals (solid filled shapes, clip-path reveals, charts, kinetic typography, node graphs, etc.).
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/setup-agent/system.md
git commit -m "fix(setup-agent): remove stale manifest read rule, fix old track names, fix SVG reference"
```

---

### Task 2: Fix identity.xml — old track name

**Files:**
- Modify: `packages/sandbox/src/prompts/shared/identity.xml`

- [ ] **Step 1: Replace old "scene-bg track" reference**

Find (around line 26-27):

```
  When available, overlay scenes can place elements behind the speaker using the
  scene-bg track. The person matte layer composites the speaker on top.
```

Replace with:

```
  When available, overlay scenes can place elements behind the speaker using the
  V2 track. The person matte (V3) composites the speaker on top, and V4 holds
  elements in front of the speaker.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/shared/identity.xml
git commit -m "fix(identity): replace old scene-bg track name with V2/V3/V4"
```

---

### Task 3: Fix Planner — "split-screen" in creative concept, Section 3 heading

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/system.md`

- [ ] **Step 1: Replace "split-screen" in Contrast creative concept**

Find (around line 238):

```
- **Contrast** — two opposing ideas → a battery draining vs charging, a scale tipping, a split-screen transformation, before/after states morphing
```

Replace with:

```
- **Contrast** — two opposing ideas → a battery draining vs charging, a scale tipping, a before/after transformation, dual-state morphing
```

- [ ] **Step 2: Clarify Section 3 heading to avoid implying a separate table**

Find (around line 268):

```
### 3. Punch-ins
Punch-ins are specified **per scene** inside each overlay scene's animation brief (not as a separate global table). Each overlay scene's brief must include 1-3 punch-ins with a transcript anchor word and a scale tier:
```

Replace with:

```
### 3. Punch-in rules (specified per-scene in the animation brief, NOT a separate section)
Each overlay scene's animation brief must include 1-3 punch-ins with a transcript anchor word and a scale tier:
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/src/prompts/planner/system.md
git commit -m "fix(planner): remove banned split-screen term, clarify punch-in section heading"
```

---

### Task 4: Fix Layout Editor — SPEAKER coordinate conversion formula

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Replace the incorrect scene-local pixel conversion formulas**

The current formulas (`bbox.x * SCENE_WIDTH`) assume the normalized bbox covers the scene's coordinate space. But the normalized values from `get_speaker_position` are in **canvas space** (0-1 relative to 1080x1920). For overlay scenes, the scene is a subset of the canvas, so the conversion must account for the scene's position and scaling.

Find the "Scene-local pixel conversion" block (around lines 296-313):

```
**Scene-local pixel conversion:**
```
bboxPx.x = Math.round(bbox.x * SCENE_WIDTH)
bboxPx.y = Math.round(bbox.y * SCENE_HEIGHT)
bboxPx.w = Math.round(bbox.w * SCENE_WIDTH)
bboxPx.h = Math.round(bbox.h * SCENE_HEIGHT)
centerPx.x = Math.round(center.x * SCENE_WIDTH)
centerPx.y = Math.round(center.y * SCENE_HEIGHT)
```

Use `SCENE_WIDTH` and `SCENE_HEIGHT` from the scene's placement preset — NOT the full canvas 1080×1920. VISIBLE_ZONES pixel values also use scene dimensions:
```
VISIBLE_ZONES.left.w  = bboxPx.x
VISIBLE_ZONES.right.x = bboxPx.x + bboxPx.w
VISIBLE_ZONES.right.w = SCENE_WIDTH - VISIBLE_ZONES.right.x
VISIBLE_ZONES.top.h   = bboxPx.y
VISIBLE_ZONES.bottom.y = bboxPx.y + bboxPx.h
VISIBLE_ZONES.bottom.h = SCENE_HEIGHT - VISIBLE_ZONES.bottom.y
```
```

Replace the entire block with:

```markdown
**Scene-local pixel conversion (canvas-normalized → scene-local):**

The normalized bbox from `get_speaker_position` is in **canvas space** (0-1 relative to CANVAS_W × CANVAS_H). For overlay scenes, the scene is a positioned subset of the canvas. Convert by mapping canvas pixels to scene-local pixels:

```
// sceneTransform = the scene item's transform (x, y, width, height on canvas)
// Example: overlay-large → { x: 40, y: 880, width: 1000, height: 960 }

// Step 1: Convert normalized bbox to canvas pixels
const canvasBboxX = bbox.x * CANVAS_W;
const canvasBboxY = bbox.y * CANVAS_H;
const canvasBboxW = bbox.w * CANVAS_W;
const canvasBboxH = bbox.h * CANVAS_H;
const canvasCenterX = center.x * CANVAS_W;
const canvasCenterY = center.y * CANVAS_H;

// Step 2: Convert canvas pixels to scene-local pixels
const scaleX = SCENE_WIDTH / sceneTransform.width;
const scaleY = SCENE_HEIGHT / sceneTransform.height;

bboxPx.x = Math.round((canvasBboxX - sceneTransform.x) * scaleX)
bboxPx.y = Math.round((canvasBboxY - sceneTransform.y) * scaleY)
bboxPx.w = Math.round(canvasBboxW * scaleX)
bboxPx.h = Math.round(canvasBboxH * scaleY)
centerPx.x = Math.round((canvasCenterX - sceneTransform.x) * scaleX)
centerPx.y = Math.round((canvasCenterY - sceneTransform.y) * scaleY)
```

If matte offset was applied (Step 4b), use the **post-offset** canvas positions from Step 4b's recalculation instead of raw `get_speaker_position` values.

VISIBLE_ZONES are derived from the scene-local bboxPx:
```
VISIBLE_ZONES.left.w  = bboxPx.x
VISIBLE_ZONES.right.x = bboxPx.x + bboxPx.w
VISIBLE_ZONES.right.w = SCENE_WIDTH - VISIBLE_ZONES.right.x
VISIBLE_ZONES.top.h   = bboxPx.y
VISIBLE_ZONES.bottom.y = bboxPx.y + bboxPx.h
VISIBLE_ZONES.bottom.h = SCENE_HEIGHT - VISIBLE_ZONES.bottom.y
```
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "fix(layout-editor): correct SPEAKER coordinate conversion from canvas-normalized to scene-local"
```

---

### Task 5: Fix good-plan.md example — punch-in format, add zone annotations

**Files:**
- Modify: `packages/sandbox/src/prompts/planner/examples/good-plan.md`

- [ ] **Step 1: Replace the global Punch-in Locations table with per-scene format**

Find (around lines 260-265):

```markdown
## Punch-in Locations
| Timestamp | Crop | Notes |
|---|---|---|
| 3500ms | { x: 50, y: 40, scale: 1.3 } | "seventy-three percent" — emphasis on the shocking statistic during Scene 1 (Overlay) |
| 44000ms | { x: 50, y: 42, scale: 1.25 } | "that's non-negotiable" — conviction beat during Scene 4 (Overlay) |
| 64000ms | { x: 50, y: 38, scale: 1.35 } | "faster than you ever expected" — closing promise during Scene 6 (Overlay) |
```

Replace with:

```markdown
## Punch-in Rules
Punch-ins are specified per-scene inside each overlay animation brief above. Summary:
- Scene 1: Punch-in 1.25x at "seventy-three percent" — emphasis on the shocking stat
- Scene 4: Punch-in 1.25x at "that's non-negotiable" — conviction beat
- Scene 6: Punch-in 1.35x at "faster than you ever expected" — closing promise
```

- [ ] **Step 2: Add zone annotations and punch-in markers to overlay scene briefs**

In Scene 1's animation brief (around line 50), find:

```
Large "73%" counter EMERGES BEHIND the speaker from center, scaling up as the speaker begins "seventy-three percent of people."
```

Replace the full brief with:

```
Punch-in 1.25x at "seventy-three percent".
Large "73%" counter (behind-speaker, full-behind) EMERGES BEHIND the speaker from center, scaling up as the speaker begins "seventy-three percent of people." The number is wide enough to PEEK from both sides of the speaker's shoulders. Red fill rises from 0% to 73% while the speaker says "who start a fitness routine quit" — counter ticks up in sync behind the speaker's body. As the speaker says "it's not because they're lazy," the glass cracks at the 73% mark and red tint pulses outward behind the speaker. "73% quit" text (in-front-of-speaker, lower-third) slides in IN FRONT of the speaker at the bottom third when the speaker hits "three critical mistakes." The depth contrast — massive stat behind, label in front — creates emphasis. Everything scales down and fades before the cut. Split: Scene1Behind + Scene1Front.
```

In Scene 4's animation brief (around line 173), find:

```
Gauge arc scales in as the speaker says "no nutrition plan."
```

Replace the full brief with:

```
Punch-in 1.25x at "that's non-negotiable".
Gauge arc (in-front-of-speaker, lower-third) scales in as the speaker says "no nutrition plan." Needle starts rotating as "if you're not eating enough protein" plays — sweeping through "Empty" and "Low" zones with labels fading in at each section. When the speaker says "point seven to one gram," the needle reaches the green optimal zone and bounces with spring physics; zone pulses. "per pound, per day" types in word by word synced to "every single day." Checkmark stamps when the speaker hits "that's non-negotiable." Fade out before cut.
```

In Scene 6's animation brief (around line 256), find:

```
As the speaker says "start with progressive overload,"
```

Replace the full brief with:

```
Punch-in 1.35x at "faster than you ever expected".
As the speaker says "start with progressive overload," first icon + label (in-front-of-speaker, lower-third) springs in from bottom-left. "Prioritize recovery" triggers the second icon snapping into position with a magnetic pull. "Fix your nutrition" brings the third icon, completing the triangle — a background shape (behind-speaker, full-behind) scales up behind all three, unifying them. When the speaker hits "the results will come," the unified shape pulses and all labels brighten. Icons scale down at exit before "faster than you ever expected."
```

- [ ] **Step 3: Update the self-verification checklist**

Find the checklist item (around line 280):

```
- [x] Every Overlay scene uses a placement preset name from the preset table: center-card (Scene 1), overlay-medium (Scene 4), overlay-medium (Scene 6).
```

Add after it:

```
- [x] **Zones:** Every overlay element specifies a zone: Scene 1 (full-behind + lower-third), Scene 4 (lower-third), Scene 6 (lower-third + full-behind).
- [x] **Punch-ins:** Every overlay scene has 1-3 punch-ins: Scene 1 (1.25x), Scene 4 (1.25x), Scene 6 (1.35x).
- [x] **Scene splitting:** Scene 1 has elements on both layers → Split: Scene1Behind + Scene1Front.
```

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/prompts/planner/examples/good-plan.md
git commit -m "fix(planner-example): per-scene punch-ins, zone annotations, split declarations"
```

---

### Task 6: Rewrite good-layout.md example for V0-V4 architecture

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`

This is the largest task. The entire example must be rewritten to demonstrate the current V0-V4 pipeline: video cutting, V1 bg images, V3 matte items, matte offset, punch-ins, speaker data only on overlay scenes, and correct presets.

- [ ] **Step 1: Replace the entire file content**

Replace the full content of `good-layout.md` with:

````markdown
<example>
## Layout Editor Example — 4 Scenes, Depth Compositing Pipeline

**Plan summary (from SCENE_PLAN.md):**
- Scene 1: "Key Metrics" — File: Scene1.tsx — 0-14000ms — Stacked 50/50 — Width: 1080, Height: 960
- Scene 2: "Growth Chart" — File: Scene2.tsx — 14000-28000ms — Fullscreen — Width: 1080, Height: 1920
- Scene 3: "Stat Callout" — File: Scene3.tsx — 28000-42000ms — Overlay — Placement: overlay-large — Depth: emerge-behind + lower-third — Zone: above-head — Punch-in: 1.25x at "three hundred million"
- Scene 4: "Revenue Breakdown" — File: Scene4.tsx — 42000-56000ms — Stacked 50/50 — Width: 1080, Height: 960

**depthAssets (from orchestrator dispatch):**
```json
{
  "scene-3": {
    "status": "ready",
    "fgrVideo": "matte/scene-3-fgr.mp4",
    "matteVideo": "matte/scene-3.mp4",
    "background": "bg-scene-3.png"
  }
}
```

**Canvas:** 1080x1920.

---

### Step 1: Read inputs
```
read_manifest → video track (trk-video) has 3 video items after Trim Editor:
  vid-1: 0-14200ms
  vid-2: 14500-42000ms (spans Scene 2 end → Scene 3)
  vid-3: 42300-60000ms

Audio track (trk-audio) has matching segments: aud-1, aud-2, aud-3.
Parsed SCENE_PLAN.md → 4 scenes.
depthAssets → Scene 3 is READY (overlay with depth).
```

### Step 2: Create V1-V4 tracks
```
const v1 = add_track({ type: "overlay", name: "V1", position: 1 })  → { id: "trk-abc1" }
const v2 = add_track({ type: "overlay", name: "V2", position: 2 })  → { id: "trk-abc2" }
const v3 = add_track({ type: "overlay", name: "V3", position: 3 })  → { id: "trk-abc3" }
const v4 = add_track({ type: "overlay", name: "V4", position: 4 })  → { id: "trk-abc4" }
```

### Step 3: Cut source video at scene boundaries

**Split vid-2 (14500-42000ms) at Scene 2→3 boundary (28000ms):**
```
split_item({ itemId: "vid-2", atMs: 28000 })
→ { originalId: "vid-2", newId: "vid-2b" }
// vid-2: 14500-28000ms (Scene 2 — Fullscreen)
// vid-2b: 28000-42000ms (Scene 3 — Overlay READY)

// Also split paired audio at same timestamp:
split_item({ itemId: "aud-2", atMs: 28000 })
→ { originalId: "aud-2", newId: "aud-2b" }
```

**Delete V0 segments within Fullscreen and READY Overlay scenes:**
```
// Scene 2 (Fullscreen): delete vid-2
remove_item({ itemId: "vid-2" })

// Scene 3 (Overlay READY): delete vid-2b
remove_item({ itemId: "vid-2b" })
```

**Transform kept segments:**
```
// vid-1: Scene 1 (Stacked — speaker in bottom half)
update_item({ itemId: "vid-1", transform: { x: 0, y: 960, width: 1080, height: 960 } })

// vid-3: Scene 4 (Stacked — speaker in bottom half)
update_item({ itemId: "vid-3", transform: { x: 0, y: 960, width: 1080, height: 960 } })
```

**Re-read manifest to verify V0 state.**

### Auto-Center Speaker
```
auto_center_speaker()
// Adjusts objectPosition on remaining vid-1 and vid-3 segments
```

### Step 4: Place depth items for Scene 3 (READY overlay)

**V1 — Background plate:**
```
add_item({
  trackId: "trk-abc1", type: "image",
  startMs: 28000, endMs: 42000,
  transform: { x: 0, y: 0, width: 1080, height: 1920 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: 13700, props: { opacity: 1 } },
    { timeMs: 14000, props: { opacity: 0 } }
  ],
  data: { src: "bg-scene-3.png" }
})
→ bg-3
```

**V3 — Person matte:**
```
add_item({
  trackId: "trk-abc3", type: "matte",
  startMs: 28000, endMs: 42000,
  transform: { x: 0, y: 0, width: 1080, height: 1920 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: 13700, props: { opacity: 1 } },
    { timeMs: 14000, props: { opacity: 0 } }
  ],
  data: {
    fgrSrc: "matte/scene-3-fgr.mp4",
    matteSrc: "matte/scene-3.mp4",
    startFrom: 28000
  }
})
→ matte-3
```

### Step 4b: Calculate content-driven matte offset for Scene 3

**Brief says zone: `above-head` → shift matte DOWN to create headroom.**
```
const oversize = 1.15;
const matteW = Math.round(1080 * 1.15);   // 1242
const matteH = Math.round(1920 * 1.15);   // 2208
const matteX = Math.round(-(1242 - 1080) / 2);  // -81
const matteY = 250;  // push down 250px for above-head content

// Update BOTH V1 and V3 with same transform:
update_item({ itemId: "bg-3", transform: { x: -81, y: 250, width: 1242, height: 2208 } })
update_item({ itemId: "matte-3", transform: { x: -81, y: 250, width: 1242, height: 2208 } })
```

### Step 5: Place scene items

```
// Scene 1 — Stacked → V4
add_item({
  type: "scene", trackId: "trk-abc4",
  startMs: 0, endMs: 14000,
  data: { sceneFile: "Scene1.tsx", displayMode: "split-screen", sceneName: "Key Metrics" },
  transform: { x: 0, y: 0, width: 1080, height: 960 }
})
→ scene-1

// Scene 2 — Fullscreen → V4
add_item({
  type: "scene", trackId: "trk-abc4",
  startMs: 14000, endMs: 28000,
  data: { sceneFile: "Scene2.tsx", displayMode: "fullscreen", sceneName: "Growth Chart" },
  transform: { x: 0, y: 0, width: 1080, height: 1920 }
})
→ scene-2

// Scene 3 — Overlay with depth (emerge-behind) → V2
add_item({
  type: "scene", trackId: "trk-abc2",
  startMs: 28000, endMs: 42000,
  data: { sceneFile: "Scene3.tsx", displayMode: "overlay", sceneName: "Stat Callout" },
  transform: { x: 40, y: 880, width: 1000, height: 960 }
})
→ scene-3

// Scene 4 — Stacked → V4
add_item({
  type: "scene", trackId: "trk-abc4",
  startMs: 42000, endMs: 56000,
  data: { sceneFile: "Scene4.tsx", displayMode: "split-screen", sceneName: "Revenue Breakdown" },
  transform: { x: 0, y: 0, width: 1080, height: 960 }
})
→ scene-4
```

**Note:** Scene 3 goes on V2 (behind-speaker track) because its brief uses depth vocabulary (emerge-behind). Scenes 1, 2, 4 go on V4.

### Speaker spatial data (Scene 3 only — overlay)

```
const pos = get_speaker_position({ startMs: 28000, endMs: 42000 });
// pos.speaker.normalized = { bbox: { x: 0.25, y: 0.08, w: 0.50, h: 0.82 }, center: { x: 0.50, y: 0.45 } }

// Store normalized values on the scene item:
update_item({
  itemId: "scene-3",
  data: {
    sceneFile: "Scene3.tsx", displayMode: "overlay", sceneName: "Stat Callout",
    speakerBbox: { x: 0.25, y: 0.08, w: 0.50, h: 0.82 },
    speakerCenter: { x: 0.50, y: 0.45 }
  }
})

// Convert canvas-normalized to scene-local pixels (accounting for matte offset):
// Post-offset canvas position: speakerCanvasX = 0.25 * 1242 + (-81) = 229.5
// Scene transform: { x: 40, y: 880, width: 1000, height: 960 }
// Scene-local: (229.5 - 40) * (1000 / 1000) = 189.5 → bboxPx.x = 190

// Write SPEAKER constants to Scene3.tsx skeleton file using Edit tool.
```

**Stacked and Fullscreen scenes (1, 2, 4): NO speaker data added.**

### Step 6: Add transition keyframes

**Scene items — opacity-only cross-fades:**
```
// Scene 1 (14000ms duration):
update_item({ itemId: "scene-1", keyframes: [
  { timeMs: 0, props: { opacity: 0 } }, { timeMs: 300, props: { opacity: 1 } },
  { timeMs: 13700, props: { opacity: 1 } }, { timeMs: 14000, props: { opacity: 0 } }
]})

// Scene 2 (14000ms duration):
update_item({ itemId: "scene-2", keyframes: [
  { timeMs: 0, props: { opacity: 0 } }, { timeMs: 300, props: { opacity: 1 } },
  { timeMs: 13700, props: { opacity: 1 } }, { timeMs: 14000, props: { opacity: 0 } }
]})

// Scene 3 (14000ms duration):
update_item({ itemId: "scene-3", keyframes: [
  { timeMs: 0, props: { opacity: 0 } }, { timeMs: 300, props: { opacity: 1 } },
  { timeMs: 13700, props: { opacity: 1 } }, { timeMs: 14000, props: { opacity: 0 } }
]})

// Scene 4 (14000ms duration):
update_item({ itemId: "scene-4", keyframes: [
  { timeMs: 0, props: { opacity: 0 } }, { timeMs: 300, props: { opacity: 1 } },
  { timeMs: 13700, props: { opacity: 1 } }, { timeMs: 14000, props: { opacity: 0 } }
]})
```

**V0 video segments — fade at cut edges:**
```
// vid-1 (0-14200ms): fade out at Scene 1 → Scene 2 boundary
update_item({ itemId: "vid-1", keyframes: [
  { timeMs: 13700, props: { opacity: 1 } },
  { timeMs: 14000, props: { opacity: 0 } }
]})

// vid-3 (42300-60000ms): fade in at Scene 3 → Scene 4 boundary
update_item({ itemId: "vid-3", keyframes: [
  { timeMs: 0, props: { opacity: 0 } },
  { timeMs: 300, props: { opacity: 1 } }
]})
```

**Punch-in keyframes for Scene 3 (V1 + V3 matched zoom):**
```
// Brief says: Punch-in 1.25x at "three hundred million" (transcript timestamp: 35200ms)
// Relative to V1/V3 item startMs (28000): anchorMs = 35200 - 28000 = 7200

const scale = 1.25;
const punchW = Math.round(1242 * 1.25);  // 1553
const punchH = Math.round(2208 * 1.25);  // 2760
const punchX = Math.round((-81 + 1242/2) - 1553/2);  // -237
const punchY = Math.round((250 + 2208/2) - 2760/2);  // -26

// Add to BOTH bg-3 and matte-3 (identical keyframes):
// Note: these are V1/V3 depth item keyframes — position animation is allowed here.
// The opacity-only rule applies to V2/V4 scene items only.
const punchInKeyframes = [
  { timeMs: 7050, props: { x: -81, y: 250, width: 1242, height: 2208 } },
  { timeMs: 7350, props: { x: -237, y: -26, width: 1553, height: 2760 } },
  { timeMs: 9350, props: { x: -237, y: -26, width: 1553, height: 2760 } },
  { timeMs: 9650, props: { x: -81, y: 250, width: 1242, height: 2208 } }
];
// Merge with existing opacity keyframes on bg-3 and matte-3
```

### Step 7: Verify
```
render_still({ atMs: 7000 })   → Scene 1: speaker bottom half, scene top half
render_still({ atMs: 21000 })  → Scene 2: fullscreen scene, no speaker video
render_still({ atMs: 35000 })  → Scene 3: bg image + matte speaker + overlay scene (depth)
render_still({ atMs: 49000 })  → Scene 4: speaker bottom half, scene top half
```

### Final manifest state
- **Tracks:** V0 (video), A0 (audio), V1 (bg plates), V2 (behind-speaker scenes), V3 (matte), V4 (front scenes/stacked/fullscreen)
- **V0 items:** 2 remaining (vid-1 stacked, vid-3 stacked) — vid-2 and vid-2b deleted
- **V1 items:** 1 (bg-scene-3.png for Scene 3)
- **V3 items:** 1 (matte for Scene 3)
- **Scene items:** 4 total — Scene 3 on V2, others on V4
- **Speaker data:** Only Scene 3 (overlay) has speakerBbox and speakerCenter
- **Matte offset:** Scene 3 V1+V3 shifted to { x: -81, y: 250, width: 1242, height: 2208 }
- **Punch-ins:** 1 punch-in on Scene 3 at 35200ms (V1+V3 zoom 1.25x)
- **Audio:** All segments intact, split at 28000ms but never deleted
</example>
````

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/examples/good-layout.md
git commit -m "feat(layout-editor-example): rewrite for V0-V4 architecture with depth compositing"
```

---

### Task 7: Clean up prompt-loader.ts — remove dead head tracking code

**Files:**
- Modify: `packages/sandbox/src/prompts/prompt-loader.ts`

- [ ] **Step 1: Remove `hasHeadTracking` from PromptContext interface**

Find (around line 100):

```typescript
  hasHeadTracking?: boolean;
```

Remove the line entirely.

- [ ] **Step 2: Remove the `HAS_HEAD_TRACKING` injection**

Find (around line 121):

```typescript
    .replaceAll('{{HAS_HEAD_TRACKING}}', String(ctx.hasHeadTracking ?? false))
```

Remove the line entirely.

- [ ] **Step 3: Remove unused `STACKED_VISUAL_RATIO` constant and injection**

Find (around lines 106-110):

```typescript
/** Split ratio for stacked layout: visuals get this percentage of canvas height. */
const STACKED_VISUAL_RATIO = 0.55;

export function injectContext(prompt: string, ctx: PromptContext): string {
  const stackedVisualHeight = Math.round(ctx.canvasHeight * STACKED_VISUAL_RATIO);
```

Replace with:

```typescript
export function injectContext(prompt: string, ctx: PromptContext): string {
```

Also find (around line 115):

```typescript
    .replaceAll('{{STACKED_VISUAL_HEIGHT}}', String(stackedVisualHeight))
```

Remove the line entirely.

- [ ] **Step 4: Verify no templates use the removed variables**

```bash
grep -r "HAS_HEAD_TRACKING\|STACKED_VISUAL_HEIGHT" packages/sandbox/src/prompts/ --include="*.md" --include="*.xml"
```

Expected: No matches (identity.xml uses `HAS_SEGMENTATION`, not `HAS_HEAD_TRACKING`).

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/prompts/prompt-loader.ts
git commit -m "chore(prompt-loader): remove dead hasHeadTracking and unused STACKED_VISUAL_RATIO"
```

---

## Self-Review

**Issue coverage check:**

| Review Issue | Task | Status |
|---|---|---|
| C1: Setup Agent reads nonexistent manifest data | Task 1 Step 1 | Covered |
| C2: Good-layout uses old 3-track architecture | Task 6 | Covered (full rewrite) |
| C3: Non-existent `lower-third-center` preset | Task 6 | Covered (full rewrite) |
| C4: Speaker data on Stacked/Fullscreen items | Task 6 | Covered (full rewrite) |
| C5: `visibleZones` not stored by Layout Editor | Task 6 | Covered (example only stores speakerBbox/speakerCenter) |
| C6: Good-plan uses old punch-in format | Task 5 | Covered |
| I1: "split-screen" in creative concept | Task 3 Step 1 | Covered |
| I2: Wrong SPEAKER coordinate formula | Task 4 | Covered |
| I3: identity.xml old track name | Task 2 | Covered |
| I4: Setup Agent old track names in comments | Task 1 Step 2 | Covered |
| I5: Good-layout missing key features | Task 6 | Covered (full rewrite) |
| I6: Section 3 heading misleading | Task 3 Step 2 | Covered |
| I7: "SVG paths" in anti-card rule | Task 1 Step 3 | Covered |
| I8: Dead `STACKED_VISUAL_RATIO` code | Task 7 Step 3 | Covered |
| I9: Caption track creation unclear | Not covered — out of scope (system behavior, not prompt issue) |
| I10: Pre-scene video segments | Task 6 | Covered (example starts scenes at 0ms) |

**Placeholder scan:** No TBDs, TODOs, or "fill in details" found.

**Type consistency:** All track names use V0-V4 consistently across tasks. All coordinate formulas use the same canvas-to-scene-local conversion.
