# Plan 4: Layout Editor — NLE Video Cuts & Track Architecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the layout editor prompt to cut source video at scene boundaries, create V0-V4 tracks, place background images and matte items (fgrSrc+matteSrc), and handle multi-layer transitions.

**Prerequisites:** Plan 3 complete (orchestrator passes depthAssets to layout editor).

**Dependency chain:** `Plan 1` → `Plan 2` → `Plan 3` → **`Plan 4`** → `Plan 5` → `Plan 6`

---

### Task 1: Replace the core principle — cuts not keyframes

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Replace "Keyframes, Not Splits" with the NLE cutting rules**

```markdown
## Core Principle — Cut Video Like a Proper NLE

The source video is physically CUT at scene boundaries. If the speaker video isn't directly visible, the segment is removed from the timeline. Audio is separate and never touched.

**Overlay (READY):** Video CUT OUT. Replaced by background image (V1) + matte item fgr+matte (V3). Animations on V2/V4.
**Overlay (FAILED):** Video KEPT (no depth assets). Full canvas transform. Animations on V4 only.
**Fullscreen:** Video CUT OUT. Animations on V4 fill the canvas.
**Stacked:** Video KEPT. Transformed to bottom portion. Animations fill the top on V4.
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): replace keyframe principle with NLE video cuts"
```

---

### Task 2: Update track creation to V0-V4

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Replace track creation section**

```markdown
### Step 2: Create the layer sandwich tracks

```
add_track({ type: "overlay", name: "V1", position: 1 })  → background plates
add_track({ type: "overlay", name: "V2", position: 2 })  → behind-speaker animations
add_track({ type: "overlay", name: "V3", position: 3 })  → matted speaker
add_track({ type: "overlay", name: "V4", position: 4 })  → in-front-of-speaker animations
```

| Track | Position | Contents |
|---|---|---|
| V4 | 4 | Animations in front of speaker / fullscreen / stacked |
| V3 | 3 | Matte — fgr + matte composited (overlay scenes only) |
| V2 | 2 | Animations behind speaker (overlay depth briefs only) |
| V1 | 1 | Clean background images (overlay scenes only) |
| V0 | 0 | Source video (kept for stacked, cut for overlay/fullscreen) |
| A0 | — | Audio — continuous, never cut |

Scene track assignment:
- Overlay with depth briefs (behind, emerge-behind, peek-sides, etc.) → V2
- All other scenes → V4
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): V0-V4 track architecture"
```

---

### Task 3: Video cutting algorithm

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Replace Step 3 with the cutting algorithm**

```markdown
### Step 3: Cut source video at scene boundaries

Split source video at every scene boundary, then delete segments where the video isn't shown.

| Scene type | Depth status | Video action |
|---|---|---|
| Overlay | READY | **CUT OUT** — delete segment |
| Overlay | FAILED | **KEEP** — full canvas |
| Fullscreen | n/a | **CUT OUT** — delete segment |
| Stacked | n/a | **KEEP** — bottom portion transform |

Algorithm:
1. List all video items on V0, sorted by startMs
2. List all scene boundaries from SCENE_PLAN.md
3. Split video at every scene boundary using `split_item`
4. Also split paired audio items at same timestamps (but NEVER delete audio)
5. Delete V0 segments within READY overlay and fullscreen scenes
6. Transform kept segments:
   - Stacked: `{ x: 0, y: SCENE_H, width: CANVAS_W, height: CANVAS_H - SCENE_H }`
   - FAILED overlay: `{ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H }`
7. Re-read manifest to verify V0 state
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): video cutting algorithm for overlay/fullscreen"
```

---

### Task 4: Background and matte item placement

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Add placement rules for V1 and V3**

```markdown
### Step 4: Place depth items for READY overlay scenes

For each READY overlay scene, add TWO items:

**V1 — Background plate:**
```
add_item({
  trackId: "trk-V1", type: "image",
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, opacity: 1 },
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: { src: "bg-{sceneId}.png" }
})
```

**V3 — Person matte:**
```
add_item({
  trackId: "trk-V3", type: "matte",
  startMs: sceneStartMs, endMs: sceneEndMs,
  transform: { ... },  // calculated in Plan 5 (overlay positioning)
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: sceneDuration - 300, props: { opacity: 1 } },
    { timeMs: sceneDuration, props: { opacity: 0 } },
  ],
  data: { fgrSrc: "matte/{sceneId}-fgr.mp4", matteSrc: "matte/{sceneId}.mp4", startFrom: 0 }
})
```
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): background and matte item placement for overlay scenes"
```

---

### Task 5: Multi-layer scene transitions

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Add the transition matrix**

```markdown
### Scene Transitions — Coordinated Multi-Layer Fades

All transitions are 300ms. Every layer involved in the boundary gets synchronized opacity keyframes.

| Transition | V0 (video) | V1 (bg) | V3 (matte) | V2/V4 (scenes) |
|---|---|---|---|---|
| Stacked → Overlay | fade out 300ms | fade in 300ms | fade in 300ms | cross-fade |
| Overlay → Stacked | fade in 300ms | fade out 300ms | fade out 300ms | cross-fade |
| Stacked → Fullscreen | fade out 300ms | — | — | cross-fade |
| Fullscreen → Stacked | fade in 300ms | — | — | cross-fade |
| Overlay → Fullscreen | — | fade out 300ms | fade out 300ms | cross-fade |
| Fullscreen → Overlay | — | fade in 300ms | fade in 300ms | cross-fade |
| Overlay → Overlay | — | cross-fade if diff bg | position morph | cross-fade |
| Stacked → Stacked | transform anim | — | — | cross-fade |
| Fullscreen → Fullscreen | — | — | — | cross-fade |

Rules:
1. V0 segments bordering a cut gap get fade keyframes at the edge
2. V1 and V3 items always have 300ms fade in at start, fade out at end
3. Overlay→Overlay: outgoing V1/V3 fade out, incoming V1/V3 fade in (300ms overlap)
4. Scene items (V2/V4) always cross-fade: outgoing fades out last 300ms, incoming fades in first 300ms
```

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): multi-layer transition matrix for depth compositing"
```

---

### Task 6: Update track structure table and workflow summary

**Files:**
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md`

- [ ] **Step 1: Replace the workflow summary at the bottom**

Update the Layout Editor's `<task>` workflow section to reflect the new steps:
1. Read SCENE_PLAN.md + depthAssets status from dispatch
2. Create V1-V4 tracks
3. Cut video at scene boundaries, delete overlay/fullscreen segments
4. Place background image (V1) and matte items fgr+matte (V3) for READY overlay scenes
5. Place scene items on V2/V4 for all scenes
6. Call `get_speaker_position` for overlay scenes, update scene items and write SPEAKER constants
7. Add transition keyframes across all layers
8. Call `auto_center_speaker` for stacked-mode video segments
9. Render stills to verify composition
10. Report completion

- [ ] **Step 2: Commit**

```bash
git add packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(layout-editor): complete workflow rewrite for depth compositing pipeline"
```
