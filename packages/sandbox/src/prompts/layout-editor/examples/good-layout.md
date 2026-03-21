<example>
## Layout Editor Example — 4 Scenes, Multiple Video Segments

**Plan summary (from SCENE_PLAN.md):**
- Scene 1: "Key Metrics" — File: Scene1.tsx — 8000-22000ms — Stacked 50/50 — Width: 1080, Height: 960
- Scene 2: "Growth Chart" — File: Scene2.tsx — 22000-38000ms — Fullscreen — Width: 1080, Height: 1920
- Scene 3: "Stat Callout" — File: Scene3.tsx — 38000-51000ms — Overlay — Placement: lower-third-center
- Scene 4: "Revenue Breakdown" — File: Scene4.tsx — 51000-64000ms — Stacked 50/50 — Width: 1080, Height: 960
**Transitions from plan:**
- Scene 1 entry: Speaker → Stacked (300ms)
- Scene 1 → Scene 2: Stacked → Fullscreen (300ms)
- Scene 2 → Scene 3: Fullscreen → Overlay (300ms)
- Scene 3 → Scene 4: Overlay → Stacked (300ms)
- Scene 4 exit: Stacked → Speaker (300ms)

**Canvas:** 1080x1920.

---

### Step 1: Read inputs
```
read_manifest → video track (trk-video) has 8 video items after Trim Editor (fillers removed):
  vid-1: 0-3200ms
  vid-2: 3500-7800ms
  vid-3: 8100-14500ms
  vid-4: 14800-22000ms (spans Scene 1 end)
  vid-5: 22200-37800ms
  vid-6: 38100-43500ms
  vid-7: 43800-50800ms
  vid-8: 51200-70000ms (spans Scene 3→4 boundary and Scene 4 end)

Audio track (trk-audio) has matching segments.
Read SCENE_PLAN.md → 4 scenes parsed
get_speaker_position → face centered at x:50%, y:30%
```

### Step 2: Create scene track
```
add_track({ type: "overlay", name: "Scenes" })
→ trk-scenes
```

### Step 3: Set speaker transforms on video segments

**Map each video segment to scene(s):**
- vid-1 (0-3200ms): Before Scene 1 → Speaker state (full canvas, no change needed)
- vid-2 (3500-7800ms): Before Scene 1 → Speaker state (no change)
- vid-3 (8100-14500ms): Entirely within Scene 1 (Stacked) → static transform
- vid-4 (14800-22000ms): Entirely within Scene 1 (Stacked) → static transform
- vid-5 (22200-37800ms): Entirely within Scene 2 (Fullscreen) → static opacity 0
- vid-6 (38100-43500ms): Entirely within Scene 3 (Overlay) → no transform change
- vid-7 (43800-50800ms): Entirely within Scene 3 (Overlay) → no transform change
- vid-8 (51200-70000ms): Spans Scene 4 (Stacked, 51000-64000) and outro → transition keyframes at 64000ms

Note: Scene boundaries at 8000, 22000, 38000, 51000 fall in the GAPS between video segments (where fillers were removed). This means most segments fall cleanly within one scene. Only vid-8 spans a boundary.

**Apply transforms:**
```
// vid-1, vid-2: Speaker state — default full canvas, no update needed

// vid-3: Scene 1 (Stacked — bottom half)
update_item({ itemId: "vid-3", transform: { x: 0, y: 960, width: 1080, height: 960 } })

// vid-4: Scene 1 (Stacked — bottom half)
update_item({ itemId: "vid-4", transform: { x: 0, y: 960, width: 1080, height: 960 } })

// vid-5: Scene 2 (Fullscreen — hidden)
update_item({ itemId: "vid-5", keyframes: [{ timeMs: 0, props: { opacity: 0 } }] })

// vid-6: Scene 3 (Overlay — full canvas, no change needed)
// vid-7: Scene 3 (Overlay — full canvas, no change needed)

// vid-8: Starts in Scene 4 (Stacked), exits to Speaker at 64000ms
// vid-8 starts at 51200ms. Scene 4 ends at 64000ms → relative timeMs: 64000-51200 = 12800ms
update_item({
  itemId: "vid-8",
  transform: { x: 0, y: 960, width: 1080, height: 960 },
  keyframes: [
    // Stacked → Speaker transition at Scene 4 end
    { timeMs: 12800, props: { x: 0, y: 960, width: 1080, height: 960, opacity: 1 } },
    { timeMs: 13100, props: { x: 0, y: 0, width: 1080, height: 1920, opacity: 1 } }
  ]
})
```

### Step 4: Place scene items

**Overlay preset map:** `lower-third-center` → { x: 140, y: 1200, width: 800, height: 480 }

```
add_item({
  type: "scene", trackId: "trk-scenes",
  startMs: 8000, endMs: 22000,
  data: { sceneFile: "Scene1.tsx", displayMode: "split-screen", sceneName: "Key Metrics", sceneType: "data-viz" },
  transform: { x: 0, y: 0, width: 1080, height: 960 }
})
→ scene-1

add_item({
  type: "scene", trackId: "trk-scenes",
  startMs: 22000, endMs: 38000,
  data: { sceneFile: "Scene2.tsx", displayMode: "fullscreen", sceneName: "Growth Chart", sceneType: "data-viz" },
  transform: { x: 0, y: 0, width: 1080, height: 1920 }
})
→ scene-2

add_item({
  type: "scene", trackId: "trk-scenes",
  startMs: 38000, endMs: 51000,
  data: { sceneFile: "Scene3.tsx", displayMode: "overlay", sceneName: "Stat Callout", sceneType: "data-viz" },
  transform: { x: 140, y: 1200, width: 800, height: 480 }
})
→ scene-3

add_item({
  type: "scene", trackId: "trk-scenes",
  startMs: 51000, endMs: 64000,
  data: { sceneFile: "Scene4.tsx", displayMode: "split-screen", sceneName: "Revenue Breakdown", sceneType: "data-viz" },
  transform: { x: 0, y: 0, width: 1080, height: 960 }
})
→ scene-4
```

### Step 5: Add transition keyframes to scene items

**Scene 1 — Stacked entrance + exit (duration = 14000ms):**
```
update_item({
  itemId: "scene-1",
  keyframes: [
    { timeMs: 0, props: { y: -960, opacity: 0 } },
    { timeMs: 300, props: { y: 0, opacity: 1 } },
    { timeMs: 13700, props: { y: 0, opacity: 1 } },
    { timeMs: 14000, props: { y: -960, opacity: 0 } }
  ]
})
```

**Scene 2 — Fullscreen entrance + exit (duration = 16000ms):**
```
update_item({
  itemId: "scene-2",
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: 15700, props: { opacity: 1 } },
    { timeMs: 16000, props: { opacity: 0 } }
  ]
})
```

**Scene 3 — Overlay entrance + exit (duration = 13000ms):**
```
update_item({
  itemId: "scene-3",
  keyframes: [
    { timeMs: 0, props: { opacity: 0 } },
    { timeMs: 300, props: { opacity: 1 } },
    { timeMs: 12700, props: { opacity: 1 } },
    { timeMs: 13000, props: { opacity: 0 } }
  ]
})
```

**Scene 4 — Stacked entrance + exit (duration = 13000ms):**
```
update_item({
  itemId: "scene-4",
  keyframes: [
    { timeMs: 0, props: { y: -960, opacity: 0 } },
    { timeMs: 300, props: { y: 0, opacity: 1 } },
    { timeMs: 12700, props: { y: 0, opacity: 1 } },
    { timeMs: 13000, props: { y: -960, opacity: 0 } }
  ]
})
```

### Step 6: Verify
```
render_still({ atMs: 15000 })  → Scene 1: speaker bottom half, scene top half
render_still({ atMs: 30000 })  → Scene 2: fullscreen scene, speaker hidden
render_still({ atMs: 45000 })  → Scene 3: speaker full size, overlay at lower third
render_still({ atMs: 57000 })  → Scene 4: speaker bottom half, scene top half
```

### Final manifest state
- **Tracks:** trk-video, trk-audio, trk-scenes
- **Video items:** 8 on trk-video (from trimming)
- **Audio items:** 8 on trk-audio (matching)
- **Scene items:** 4 on trk-scenes (type 'scene', one per scene)
- **No splits at scene boundaries** — all display mode changes via transforms + keyframes
- **Key observation:** Scene boundaries mostly fall in gaps between video segments (where fillers were). Segments within one scene get static transforms. Only segments spanning boundaries get keyframes.
</example>
