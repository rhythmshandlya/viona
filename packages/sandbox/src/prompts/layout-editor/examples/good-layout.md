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
