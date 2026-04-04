# Sandbox be06b344 — Bug Report

**Date:** 2026-04-03
**Project:** be06b344-e5ac-44d1-8d0a-5c47465d6a7f
**Video:** Algeria_testsample.mp4 (65.8s, 1080x1920)
**Theme:** magazine
**Session:** d84f4d5f-073e-4f79-9d82-fa3e5065bddd (Opus 4.6, 71 tools, 9 MCP servers)
**Cost so far:** $2.31 (first turn) + resumed session (still running)

---

## Bug 1: Scene Registry Generator Ignores Split Scene Files (CRITICAL)

**File:** `packages/sandbox/src/scene-registry-generator.ts:16`

**Problem:** The regex `/^Scene\d+\.tsx$/` only matches files named `Scene1.tsx`, `Scene2.tsx`, etc. It does NOT match the split scene naming convention used by overlay scenes: `Scene1Behind.tsx`, `Scene1Front.tsx`, `Scene5Behind.tsx`, etc.

**Impact:** Out of 13 scene files in `src/scenes/`, only 3 are registered (Scene2, Scene3, Scene4). The 10 split scene files (5 Behind + 5 Front for Scenes 1, 5, 6, 7, 8) are completely invisible to the renderer. The manifest references `Scene1Front.tsx`, `Scene5Front.tsx`, etc. but they resolve to `undefined` in the registry — those scenes render as blank.

**Evidence:**
```
Registry log at boot:     count: 0  (no scenes yet)
Registry log after setup: count: 3  (only Scene2, Scene3, Scene4)
```

Current registry:
```ts
export const sceneRegistry = {
  'Scene2.tsx': Scene2_default,
  'Scene3.tsx': Scene3_default,
  'Scene4.tsx': Scene4_default,
  // Scene1Front.tsx, Scene1Behind.tsx, Scene5-8 Front/Behind — ALL MISSING
};
```

**Fix:** Update the regex to also match split scene files:
```ts
// Before:
sceneFiles = entries.filter(f => /^Scene\d+\.tsx$/.test(f));

// After:
sceneFiles = entries.filter(f => /^Scene\d+\w*\.tsx$/.test(f));
```

---

## Bug 2: Behind-Speaker Scene Items Missing from Manifest (CRITICAL)

**Problem:** The scene plan specifies 5 overlay scenes (1, 5, 6, 7, 8) that should each be split into Behind + Front layers (e.g., `Scene1Behind.tsx` + `Scene1Front.tsx`). The Behind files exist on disk, but **no manifest items reference them**. Only the Front files have items in the manifest.

**Impact:** Even if Bug 1 were fixed, the behind-speaker visual layer would never render. The depth compositing pipeline (speaker matte sandwiched between Behind and Front layers) is broken — only the in-front-of-speaker layer exists in the timeline.

**Evidence:**
```
Scene files on disk:  13 (5 Behind + 5 Front + 3 single)
Manifest scene items: 8  (0 Behind + 5 Front + 3 single)
Matte items:          0  (no matte compositing at all)
```

Tracks V1, V2, V3 were created (presumably for behind layers and mattes) but have zero items assigned.

**Fix:** The orchestrator/setup agent needs to create manifest items for Behind scenes on the appropriate track (below the video track, above nothing — or between video and matte). Also needs matte items once segmentation completes.

---

## Bug 3: Template Re-Export Scenes Receive No Data Props (HIGH)

**File:** `packages/sandbox/template/src/items/SceneItem.tsx`

**Problem:** Stacked scenes (2, 3, 4) re-export templates directly:
```tsx
// Scene2.tsx
export { default } from '../components/templates/magazine-country';
```

But `SceneItem.tsx` only passes `width`, `height`, `durationInFrames`, `fps` to scene components — it does NOT forward `item.data` as props. The `magazine-country` template expects `countryName`, `countryCode`, `cityLat`, `cityLng`, `animationStyle`, etc. via props, but receives none.

**Impact:** All 3 country scenes (China, India, Algeria) render with the template's **default values** (United Kingdom, London, smoothZoom). The scene-specific data is documented in comments at the top of each scene file but never actually passed.

**Evidence:**
```tsx
// SceneItem renders:
<SceneComponent width={w} height={h} durationInFrames={d} fps={fps} />
// Missing: countryName="China" countryCode="CHN" cityLat={39.9042} ...
```

**Fix (Option A — scene wrapper):** Scene files should wrap the template with hardcoded data:
```tsx
import MagazineCountry from '../components/templates/magazine-country';
const Scene2 = (props) => (
  <MagazineCountry {...props} countryName="China" countryCode="CHN" cityLat={39.9042} cityLng={116.4074} animationStyle="smoothZoom" />
);
export default Scene2;
```

**Fix (Option B — data forwarding):** Update SceneItem to spread `data` into scene component props:
```tsx
<SceneComponent {...data} width={w} height={h} durationInFrames={d} fps={fps} />
```

---

## Bug 4: Overlay Scene Components Are Empty Scaffolds (HIGH)

**Problem:** The 10 split scene files (Scene1Behind, Scene1Front, Scene5-8 Behind/Front) were created by the Setup Agent as **scaffolds with empty render bodies**:

```tsx
const Scene1Front: React.FC = () => {
  return (
    <div style={{ width: 1000, height: 960, overflow: 'hidden', position: 'relative' }}>
      {/* InFrontOfSpeaker layer only -- divider shape, cracking animation, warning-level bars */}
    </div>
  );
};
```

All imports, data, constants, and speaker zone calculations are present — but the actual visual elements (the animations described in the scene plan) are missing. The comment serves as a placeholder for the Animator agent.

**Impact:** Even if Bugs 1-3 were fixed, these scenes would render as empty transparent boxes. The Animator subagent needs to fill in the visual implementations.

**Status:** This may be expected pipeline behavior — the Setup Agent scaffolds, then the Animator fills in. But the orchestrator moved past scene creation without dispatching Animator subagents for these scenes.

---

## Bug 5: Segmentation Polling Loop — Excessive Token Burn (MEDIUM)

**Problem:** After requesting segmentation, the orchestrator entered a polling loop calling `check_segmentation_status` → `Bash` (sleep) repeatedly. Observed 10+ poll cycles over ~5+ minutes, each consuming message context.

**Evidence:**
```
messageCount at first poll:  774
messageCount at last poll:  1085
→ ~311 messages consumed by polling alone
```

The segmentation may have legitimately been processing (RVM inference on a 66s video), but the agent has no max-retry limit and no exponential backoff. Each poll cycle burns ~30 messages of context.

**Root cause:** The agent is using `sleep` between polls (Bash tool), which is wasteful. There's no server-push mechanism — the agent must poll.

**Fix options:**
1. Add a `maxPolls` limit to the orchestrator's segmentation wait logic (e.g., 10 polls max, then proceed without segmentation)
2. Implement exponential backoff (10s → 20s → 40s → 60s)
3. Add a webhook/callback from worker to sandbox when segmentation completes (eliminates polling entirely)

---

## Bug 6: `displayMode: "split-screen"` in Manifest for Stacked Scenes (LOW)

**Problem:** The scene plan explicitly specifies Scenes 2, 3, 4 as `"Stacked [50/50]"` display mode, and the self-verification table says "No 'split-screen'". But the manifest items for these scenes use `displayMode: "split-screen"`.

**Evidence:**
```json
{"sceneFile": "Scene2.tsx", "displayMode": "split-screen"}  // Plan says: Stacked [50/50]
{"sceneFile": "Scene3.tsx", "displayMode": "split-screen"}  // Plan says: Stacked [50/50]
{"sceneFile": "Scene4.tsx", "displayMode": "split-screen"}  // Plan says: Stacked [50/50]
```

**Impact:** Depends on how `displayMode` is consumed downstream. If it's just metadata, no visual impact. If it drives layout decisions (e.g., the editor UI or render pipeline), scenes may be positioned incorrectly.

**Fix:** The orchestrator should use `displayMode: "stacked"` for these scenes.

---

## Bug 7: All Scene Items on Single Track V4 (LOW)

**Problem:** All 8 scene items are assigned to the same track (`V4`, position 4). Tracks V1, V2, V3 were created but have zero items. This means:
- Behind-speaker scenes have no track assignment
- There's no Z-ordering separation between behind/front layers
- All scenes stack on the same overlay layer

**Evidence:**
```
Track V1 (pos 1): 0 items
Track V2 (pos 2): 0 items
Track V3 (pos 3): 0 items
Track V4 (pos 4): 8 items (all scenes)
```

**Expected:** Behind scenes on a lower track (e.g., V1), matte on V2, front scenes on V3/V4.

---

## Pipeline Timeline Summary

| Time (s from start) | Event | Notes |
|---|---|---|
| 0 | Boot, symlink, servers start | Clean |
| 1 | Init: download video, extract audio, generate proxies | 47s total |
| 47 | Workspace initialized, esbuild watcher started | Bundle built (145ms) |
| 52 | Orchestrator: fresh session, 71 tools | Clean startup |
| 66 | Trim Editor subagent dispatched | Completed successfully |
| 157 | Plan reported, progress reported | |
| 177 | Planner subagent dispatched | 10 `browse_templates` calls (excessive?) |
| 405 | Planner completed | Wrote SCENE_PLAN.md (thorough) |
| 547 | Plan updated, widget shown, **Turn 1 completed** | $2.31, 50 tool uses, 16 turns |
| 906 | **Turn 2 starts** — session resumed | |
| 921 | `request_segmentation` called | |
| 939 | Setup Agent dispatched | Scaffold workspace |
| ~1000-1600 | Setup Agent: fork templates, write scene files, create tracks/items | |
| 1425 | Setup Agent: `trigger_rebuild` → registry regenerated (count: 3) | **Bug 1 visible** |
| 1456 | Setup Agent completed | |
| 1466 | Orchestrator: segmentation polling begins | |
| 1466-1632 | **8+ segmentation polls** (check_status → Bash sleep loop) | **Bug 5** |
| ~1632 | Segmentation polling ends, orchestrator continues | |
| ~1640-1700 | Orchestrator: 12x `update_item` (adding scene items to manifest) | |
| ~1700 | `trigger_rebuild` + `validate_timeline` | Registry still count: 3 |
| ~1700+ | `render_still` (screenshot verification) | Currently running |

---

## Bug 8: Segmentation Processes FULL Video at FULL Resolution — Timeout Kill (CRITICAL)

**Files:**
- `packages/worker/src/processors/segmentation.ts:209` — overrides scale to 1.0
- `packages/worker/scripts/segment_person.py` — Python default is 0.5

**Problem:** Two compounding issues cause segmentation to timeout at 900s (15 min):

### Issue A: Full video instead of scene-only sections
The processor sends the ENTIRE 66s video to segment_person.py with no clipping. Comments say this is for "exact frame correspondence" and "best RVM recurrent state." But only overlay scenes NEED matting (Scenes 1, 5, 6, 7, 8 = ~45s of content in non-contiguous ranges). The stacked scenes (2, 3, 4) don't have a speaker layer at all.

### Issue B: TypeScript overrides Python's default scale from 0.5 to 1.0
```ts
// segmentation.ts line 209:
'--scale', '1.0',            // full resolution for quality
```
```python
# segment_person.py line 38:
SCALE_FACTOR = 0.5   # Python default is HALF resolution
```

At `scale=1.0`, output is 1080x1920 = 2,073,600 pixels/frame.
At `scale=0.5`, output is 540x960 = 518,400 pixels/frame — **4x fewer pixels**.

Combined: ~1975 frames at full resolution on CPU (no CUDA visible from worker logs) = timeout guaranteed.

**Evidence (worker logs):**
```
[22:58:06] Processing segmentation job (scene-1)
[23:13:09] WARN: Killing subprocess: timeout (900s)
[23:13:09] ERROR: Broken pipe (FFmpeg rawvideo muxer — Python died mid-pipe)
[23:13:14] Retry #1 starts
[23:28:17] WARN: Killing subprocess: timeout (900s) — same broken pipe
[23:28:18] Retry #2 starts (will fail again)
```

The "Broken pipe" is a symptom — FFmpeg decoder is still piping frames when the parent Python process gets SIGTERM'd after 900s.

**Fix:**
```ts
// segmentation.ts — revert to Python's default 0.5 scale
'--scale', '0.5',            // half resolution (matte doesn't need full res)
```

Also: only matte the sections that need matting (overlay scenes), not the full video. Pass time ranges to FFmpeg for seeking/clipping.

---

## Priority Order for Fixes

1. **Bug 8** (segmentation timeout) — Completely blocks depth compositing pipeline. Scale + full-video issue.
2. **Bug 1** (registry regex) — Blocks ALL split scenes from rendering. Quick fix.
3. **Bug 3** (data prop forwarding) — Blocks stacked scenes from showing correct content. Architecture decision needed.
4. **Bug 2** (behind items in manifest) — Blocks depth compositing. Orchestrator/prompt fix.
5. **Bug 4** (empty scaffolds) — Blocks overlay scene visuals. Needs Animator subagent dispatch.
6. **Bug 5** (polling loop) — Token waste. Optimization.
7. **Bug 6** (displayMode naming) — Cosmetic/metadata.
8. **Bug 7** (track assignment) — Structural, needed for depth compositing.
