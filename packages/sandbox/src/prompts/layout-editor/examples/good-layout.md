<example>
## Layout Editor Example — 3 Scenes

**Plan summary (from SCENE_PLAN.md):**
- Scene 1: "Key Metrics" — 8000-22000ms — split-screen 50/50
- Scene 2: "Growth Chart" — 28000-42000ms — fullscreen
- Scene 3: "Stat Callout" — 45000-51000ms — overlay
- Punch-in at 24000ms (between scenes 1 and 2), crop { x: 55, y: 40, scale: 1.3 }

**Canvas:** 1080x1920. Video item `vid-001` spans 0-60000ms on track `trk-video`.
Caption track `trk-captions` already exists.

---

### Step 1: Read inputs
```
read_manifest → vid-001 on trk-video (0-60000ms), trk-captions exists
Read SCENE_PLAN.md → 3 scenes parsed
Read speaker-grid.json → face at x:50%, y:30%
```

### Step 2: Create overlay track
```
add_track({ type: "overlay", name: "Overlay 1" })
→ trk-overlay-1 (position above trk-video, below trk-captions)
```

### Step 3: Split video at scene boundaries (REVERSE order)
Split points: 45000, 28000, 8000. Process latest first:
```
split_item({ itemId: "vid-001", atMs: 45000 })
→ { originalId: "vid-001", newId: "vid-seg-4" }
   vid-001: 0-45000ms, vid-seg-4: 45000-60000ms

split_item({ itemId: "vid-001", atMs: 28000 })
→ { originalId: "vid-001", newId: "vid-seg-3" }
   vid-001: 0-28000ms, vid-seg-3: 28000-45000ms, vid-seg-4: 45000-60000ms

split_item({ itemId: "vid-001", atMs: 8000 })
→ { originalId: "vid-001", newId: "vid-seg-2" }
   vid-001: 0-8000ms, vid-seg-2: 8000-28000ms, vid-seg-3: 28000-45000ms, vid-seg-4: 45000-60000ms
```

### Step 4: Split at punch-in point (REVERSE order — only one here)
Punch-in at 24000ms falls within vid-seg-2 (8000-28000ms):
```
split_item({ itemId: "vid-seg-2", atMs: 24000 })
→ { originalId: "vid-seg-2", newId: "vid-seg-2b" }
   vid-seg-2: 8000-24000ms, vid-seg-2b: 24000-28000ms

update_item({ itemId: "vid-seg-2b", data: { crop: { x: 55, y: 40, scale: 1.3 } } })
```

### Step 5: Set speaker transforms

**Scene 1 (split-screen, 8000-22000ms):** vid-seg-2 covers 8000-24000ms — split at 22000 to isolate scene range, then apply transform.
```
split_item({ itemId: "vid-seg-2", atMs: 22000 })
→ { originalId: "vid-seg-2", newId: "vid-seg-2a" }
   vid-seg-2: 8000-22000ms (scene 1), vid-seg-2a: 22000-24000ms (gap)

update_item({
  itemId: "vid-seg-2",
  transform: { x: 0, y: 960, width: 1080, height: 960 }
})
```

**Scene 2 (fullscreen, 28000-42000ms):** vid-seg-3 covers 28000-45000ms — split at 42000, then add opacity keyframe.
```
split_item({ itemId: "vid-seg-3", atMs: 42000 })
→ { originalId: "vid-seg-3", newId: "vid-seg-3a" }
   vid-seg-3: 28000-42000ms (scene 2), vid-seg-3a: 42000-45000ms (gap)

update_item({
  itemId: "vid-seg-3",
  keyframes: [{ timeMs: 0, opacity: 0 }]
})
```

**Scene 3 (overlay, 45000-51000ms):** vid-seg-4 covers 45000-60000ms — split at 51000 to isolate. No transform change (overlay = full size speaker).
```
split_item({ itemId: "vid-seg-4", atMs: 51000 })
→ { originalId: "vid-seg-4", newId: "vid-seg-5" }
   vid-seg-4: 45000-51000ms (scene 3), vid-seg-5: 51000-60000ms
```

### Step 6: Place mockup placeholders

```
add_item({
  type: "shape",
  trackId: "trk-overlay-1",
  startMs: 8000,
  endMs: 22000,
  data: {
    shape: "rectangle",
    fill: "#8B5CF6",
    sceneFile: "KeyMetrics.tsx",
    displayMode: "split-screen"
  },
  transform: { x: 0, y: 0, width: 1080, height: 960 }
})

add_item({
  type: "shape",
  trackId: "trk-overlay-1",
  startMs: 28000,
  endMs: 42000,
  data: {
    shape: "rectangle",
    fill: "#8B5CF6",
    sceneFile: "GrowthChart.tsx",
    displayMode: "fullscreen"
  },
  transform: { x: 0, y: 0, width: 1080, height: 1920 }
})

add_item({
  type: "shape",
  trackId: "trk-overlay-1",
  startMs: 45000,
  endMs: 51000,
  data: {
    shape: "rectangle",
    fill: "#3B82F6",
    sceneFile: "StatCallout.tsx",
    displayMode: "overlay"
  },
  transform: { x: 750, y: 600, width: 280, height: 160 }
})
```

### Step 7: Apply transitions
Plan specifies: Scene 1 entry crossfade 12f, Scene 2 entry flash 3f, Scene 3 entry none.

Scene 1 crossfade entry (12 frames = 400ms at 30fps): add keyframes to the mockup item.
```
update_item({
  itemId: "<scene1-mockup-id>",
  keyframes: [
    { timeMs: 0, opacity: 0 },
    { timeMs: 400, opacity: 1 }
  ]
})
```

Scene 2 flash (3 frames = 100ms): add white shape at boundary.
```
add_item({
  type: "shape",
  trackId: "trk-overlay-1",
  startMs: 27900,
  endMs: 28100,
  data: { shape: "rectangle", fill: "#FFFFFF" },
  transform: { x: 0, y: 0, width: 1080, height: 1920 },
  keyframes: [{ timeMs: 0, opacity: 0.8 }]
})
```

### Step 8: Verify
```
render_still({ atMs: 15000 })  → Scene 1: speaker bottom half, violet mockup top half
render_still({ atMs: 35000 })  → Scene 2: violet mockup full screen, speaker hidden
render_still({ atMs: 48000 })  → Scene 3: speaker full size, blue mockup at (750,600)
```

### Final manifest state
- **Tracks:** trk-video (video), trk-overlay-1 (overlay), trk-captions (caption)
- **Video segments:** 8 items on trk-video (intro, scene 1, gap, punch-in, scene 2, gap, scene 3, outro)
- **Mockups:** 3 shape items on trk-overlay-1 (one per scene)
- **Transitions:** 1 flash shape item, 1 mockup with crossfade keyframes
- **Splits performed:** 8 total (3 scene boundaries + 1 punch-in + 4 scene-range isolations)
</example>
