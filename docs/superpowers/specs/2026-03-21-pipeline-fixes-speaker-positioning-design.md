# Pipeline Fixes & Speaker Positioning

**Date:** 2026-03-21
**Status:** Draft

---

## Problem Statement

Four issues in the visual generation pipeline:

1. **render_still fails inside sandbox** — `resolveMediaSrc()` returns presigned MinIO URLs when `isRendering === true`, but headless Chrome inside Docker can't reach `host.docker.internal:9000`. Causes 118s `delayRender` timeout.

2. **Review phases waste time** — Phases 7 (Review) and 9 (Final Review) render stills, inspect output, and dispatch fix agents. These double the pipeline duration and consume excessive tokens for marginal quality gains.

3. **Overlays cover the speaker** — Animators write scene code in isolation without knowing where the speaker appears on the final canvas. The existing `get_speaker_grid` returns a coarse 6x6 grid in source video space, ignoring the `objectFit: cover` transform that repositions the speaker on canvas.

4. **Speaker not centered in frame** — `objectFit: cover` with default `objectPosition: 50% 50%` centers the video frame, not the speaker. In landscape-to-portrait conversions, the speaker can be off-center or partially cropped.

---

## Fix 1: Local Media Resolution in Sandbox

### Current Behavior

`resolveMediaSrc()` in `packages/sandbox/template/src/items/resolveMediaSrc.ts`:

```typescript
// In render mode (isRendering === true):
if (assets[src]) return assets[src];  // Returns presigned MinIO URL
```

The `assets` map contains presigned URLs like `http://host.docker.internal:9000/viona/...source.mp4?X-Amz-...`. These are meant for browser access outside the container. Inside the sandbox container, headless Chrome can't reach this endpoint.

### Fix

When rendering inside the sandbox, skip the assets map and use `staticFile(src)` which resolves to the local file in `/workspace/public/`. The proxy path (for preview) is already skipped when `isRendering === true`.

```typescript
export function resolveMediaSrc(
  src: string,
  assets: Record<string, string>,
): string {
  const { isRendering } = getRemotionEnvironment();

  // In preview mode, prefer proxy if available in assets
  if (!isRendering) {
    const proxyKey = deriveProxyKey(src);
    if (proxyKey && assets[proxyKey]) return assets[proxyKey];
  }

  // Inside sandbox render: use local files directly.
  // Presigned URLs in assets map are for browser access, not container-internal.
  if (isRendering) {
    if (/^https?:\/\/|^blob:/.test(src)) return src;
    return staticFile(src);
  }

  // Browser player: use assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

**Files changed:** `packages/sandbox/template/src/items/resolveMediaSrc.ts`

---

## Fix 2: Remove Review Phases

### Current Pipeline

```
Phase 1: Brief → Phase 2: Trim → Phase 3: Plan → Phase 4: Setup →
Phase 5: Layout → Phase 6: Animation → Phase 7: Review →
Phase 8: Final Assembly → Phase 9: Final Review → Phase 10: Done
```

Phases 7 and 9 render stills, inspect with vision, and dispatch fix agents (max 2 rounds each). This adds significant time and token cost.

### New Pipeline

```
Phase 1: Brief → Phase 2: Trim → Phase 3: Plan → Phase 4: Setup →
Phase 5: Layout → Phase 6: Animation → Phase 7: Final Assembly → Phase 8: Done
```

Renumber phases 8→7, 10→8. Remove phases 7 and 9 entirely from the orchestrator system prompt. Remove `reviewing` and `final-review` from progress phases.

**Files changed:**
- `packages/sandbox/src/prompts/orchestrator/system.md` — remove Phase 7 (Review) and Phase 9 (Final Review), renumber remaining phases
- Progress phase list: remove `reviewing`, `final-review`

---

## Fix 3: Canvas-Space Speaker Position Tool

### Problem

The existing `get_speaker_grid` tool in `packages/mcp-servers/src/asset-server.ts`:
- Returns a coarse NxN occupancy grid with abstract region names ("top-left", "bottom-right")
- Works in **source video space** — normalizes face bbox against source dimensions
- Does NOT account for `objectFit: cover` transform
- Does NOT account for video item `crop` settings (`objectPosition`, `scale`)
- Does NOT include body landmarks (shoulders, hands)

The Animator gets "speaker occupies top-left quadrant" but has no idea where the speaker actually appears on the 1080x1920 canvas after the cover crop.

### Solution: Replace `get_speaker_grid` with `get_speaker_position`

A new tool that returns exact pixel coordinates in **canvas space**, accounting for the full transform chain: source video → cover fit → crop offset → canvas position.

#### Input

```typescript
{
  startMs: number,  // Start of time range
  endMs: number,    // End of time range
}
```

#### Output

```typescript
{
  canvas: { width: number, height: number },

  // The cover+crop transform applied (for context)
  videoTransform: {
    sourceSize: { width: number, height: number },
    coverScale: number,
    crop: { x: number, y: number, scale: number },
    // The visible region of the source video after cover crop (in source pixels)
    visibleRegion: { x: number, y: number, width: number, height: number },
  },

  speaker: {
    // Full body envelope in canvas pixels (union across time range)
    bounds: { top: number, bottom: number, left: number, right: number },

    // Face bounding box in canvas pixels (averaged across range)
    face: { x: number, y: number, width: number, height: number },

    // Key body landmarks in canvas pixels
    shoulderLine: number,
    hands: {
      left:  { x: number, y: number, active: boolean },
      right: { x: number, y: number, active: boolean },
    },

    // Movement magnitude across the time range
    movement: "minimal" | "moderate" | "large",
  },

  // Pre-computed available space in canvas pixels
  availableSpace: {
    above:  { from: 0,      to: number, height: number },
    below:  { from: number, to: number, height: number },
    left:   { from: 0,      to: number, width: number  },
    right:  { from: number, to: number, width: number  },
  },

  // Concrete placement rects the Animator can use directly
  safePlacements: Array<{
    name: string,        // "top-strip", "lower-third", "left-panel", "right-panel"
    rect: { x: number, y: number, width: number, height: number },
  }>,

  confidence: number,  // 0-1, fraction of frames with successful detection
}
```

#### Transform Logic

CSS `transform: scale()` defaults to `transform-origin: 50% 50%`, scaling from the element's center. The transform chain must account for this.

```
1. Read manifest.json → find video item active during [startMs, endMs]
   → extract: item box (x, y, width, height), crop settings (x%, y%, scale)
   → If multiple video items overlap the range, use the one with the longest overlap

2. Read /workspace/docs/speaker-grid.json → filter frames in [startMs, endMs]
   → get raw face bbox + body landmarks in source pixels
   → Note: existing get_speaker_grid reads from wrong path (src/*/head_tracking.json);
     this fix corrects it to /workspace/docs/speaker-grid.json

3. Compute cover transform (two stages):

   Stage A — objectFit: cover + objectPosition:
     baseCoverScale = max(itemW / srcW, itemH / srcH)
     renderedW = srcW * baseCoverScale
     renderedH = srcH * baseCoverScale
     offsetX = (renderedW - itemW) * (crop.x / 100)
     offsetY = (renderedH - itemH) * (crop.y / 100)

   Stage B — transform: scale() from center (transform-origin: 50% 50%):
     // Position in element coords (before CSS scale)
     elementX = sourceX * baseCoverScale - offsetX
     elementY = sourceY * baseCoverScale - offsetY
     // Scale from element center
     canvasX = itemX + (elementX - itemW/2) * crop.scale + itemW/2
     canvasY = itemY + (elementY - itemH/2) * crop.scale + itemH/2

4. Edge case — aspect ratios match exactly:
   When srcW/srcH === itemW/itemH, renderedW === itemW and renderedH === itemH.
   No cropping occurs; objectPosition has no effect. Use crop = {x:50, y:50}.
   The scale transform still applies from center.

5. Aggregate across frames:
   - bounds = union of all transformed face+body detections (clamped to canvas)
   - face = average of all transformed face bboxes
   - shoulderLine = average of left + right shoulder Y coordinates (transformed)
   - hands = average position; active = hand moves >15% of canvas height across range
   - movement = based on face center standard deviation:
     <2% canvas diagonal → "minimal"
     <8% → "moderate"
     ≥8% → "large"

6. Compute available space:
   above.height = speaker.bounds.top
   below.height = canvas.height - speaker.bounds.bottom
   left.width = speaker.bounds.left
   right.width = canvas.width - speaker.bounds.right

7. Generate safePlacements:
   - Include region only if it has meaningful space (>10% of canvas dimension)
   - Apply movement-based margin: minimal=20px, moderate=40px, large=80px

8. Fallback — no face detections in range:
   Return confidence: 0 with null speaker data and entire canvas as safe.
```

#### Where to Implement

Replace the existing `get_speaker_grid` tool in `packages/mcp-servers/src/asset-server.ts` with `get_speaker_position`. The tool reads:
- `/workspace/manifest.json` — video item geometry and crop
- `/workspace/docs/speaker-grid.json` — raw per-frame detection data

Keep `get_speaker_grid` as a deprecated alias that calls `get_speaker_position` internally (backward compat for any prompts referencing it).

#### Prompt Updates

- **Layout Editor** (`packages/sandbox/src/prompts/layout-editor/system.md`): Update to reference `get_speaker_position` instead of reading `speaker-grid.json` directly. Use canvas-space coordinates for overlay validation.
- **Animator** prompts: Add instruction to call `get_speaker_position` for overlay scenes before positioning elements. Use the `safePlacements` rects directly.
- **Final Editor** (`packages/sandbox/src/prompts/final-editor/system.md`): Update overlay verification to use `get_speaker_position`.
- **Workspace CLAUDE.md** (`packages/sandbox/template/.claude/CLAUDE.md`): Document the tool and its canvas-space output.

---

## Fix 4: Auto-Center Speaker in Video

### Problem

`objectFit: cover` with `crop: { x: 50, y: 50, scale: 1 }` centers the video frame geometrically. In landscape-to-portrait conversion (1920x1080 → 1080x1920), the sides get cropped. If the speaker is off-center in the source video, they may be partially cropped or poorly framed.

### Solution

During workspace setup (Phase 4 or early Phase 5), compute the optimal `crop.x` and `crop.y` that centers the **speaker's face** in the video item's box, then update the video item in the manifest.

#### Math

Auto-centering only sets `crop.x` and `crop.y` (the `objectPosition`). It does NOT modify `crop.scale`, which remains at 1. This means only the Stage A transform (objectFit + objectPosition) applies — no Stage B scaling adjustment needed.

```
// Average face center across all frames (source video pixels)
faceCenterX = avg(face.x + face.width/2)
faceCenterY = avg(face.y + face.height/2)

// Cover scale (without crop.scale — auto-center only adjusts position)
baseCoverScale = max(itemW / srcW, itemH / srcH)
renderedW = srcW * baseCoverScale
renderedH = srcH * baseCoverScale

// Edge case: aspect ratios match → no cropping possible, keep 50/50
if (renderedW - itemW < 1 && renderedH - itemH < 1) {
  cropX = 50; cropY = 50;  // no adjustment possible
} else {
  // Solve for crop% that puts face center at item center
  // Target: faceCenterX * baseCoverScale - offsetX = itemW / 2
  // Where:  offsetX = (renderedW - itemW) * (cropX / 100)
  cropX = renderedW - itemW > 0
    ? (faceCenterX * baseCoverScale - itemW / 2) / (renderedW - itemW) * 100
    : 50;
  cropY = renderedH - itemH > 0
    ? (faceCenterY * baseCoverScale - itemH / 2) / (renderedH - itemH) * 100
    : 50;

  // Clamp to [0, 100] — can't pan beyond video bounds
  cropX = clamp(cropX, 0, 100)
  cropY = clamp(cropY, 0, 100)
}
```

**Fallback**: If `speaker-grid.json` has no frames with detected faces (`metadata.detection_rate === 0`), keep the default `crop: { x: 50, y: 50, scale: 1 }` and return a message indicating no adjustment was made.

#### Implementation

**Option: MCP tool `auto_center_speaker`**

Add a new tool to the asset server that:
1. Reads `speaker-grid.json` for average face position
2. Reads `manifest.json` for video item(s) and canvas dimensions
3. Computes optimal crop values
4. Updates the video item's `data.crop` in the manifest via the existing `update_item` tool

This tool is called by the **Layout Editor** (Phase 5) after placing the video item. The Layout Editor already validates overlay placement — centering the speaker first ensures all subsequent overlay positioning is based on the correctly-framed video.

**Files changed:**
- `packages/mcp-servers/src/asset-server.ts` — add `auto_center_speaker` tool
- `packages/sandbox/src/prompts/layout-editor/system.md` — instruct to call `auto_center_speaker` after placing video items

---

## Implementation Order

1. **Fix 1** (resolveMediaSrc) — standalone, no dependencies
2. **Fix 2** (remove review phases) — standalone, no dependencies
3. **Shared utility** (cover-transform.ts) — needed by Fixes 3 and 4
4. **Fix 4** (auto-center speaker) — uses shared utility
5. **Fix 3** (get_speaker_position) — uses shared utility, reads crop values (works with any crop, doesn't depend on Fix 4 having run)

Fixes 1 and 2 can be done in parallel. Fixes 3 and 4 share the cover-transform utility and can be implemented in either order (Fix 3 reads whatever crop values exist, defaulting to 50/50 if auto-center hasn't run).

---

## Shared Utility: Cover Transform

Both Fix 3 and Fix 4 need the same transform math. Extract into a shared module:

```typescript
// packages/mcp-servers/src/utils/cover-transform.ts

interface CoverTransform {
  baseCoverScale: number;  // max(itemW/srcW, itemH/srcH)
  renderedW: number;       // srcW * baseCoverScale (before CSS scale)
  renderedH: number;       // srcH * baseCoverScale (before CSS scale)
  offsetX: number;         // objectPosition X offset
  offsetY: number;         // objectPosition Y offset
  cropScale: number;       // CSS transform: scale() value
  itemW: number;
  itemH: number;
}

/** Compute the objectFit:cover + crop transform parameters */
export function computeCoverTransform(
  srcW: number, srcH: number,
  itemW: number, itemH: number,
  cropX = 50, cropY = 50, cropScale = 1,
): CoverTransform {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const offsetX = (renderedW - itemW) * (cropX / 100);
  const offsetY = (renderedH - itemH) * (cropY / 100);
  return { baseCoverScale, renderedW, renderedH, offsetX, offsetY, cropScale, itemW, itemH };
}

/**
 * Transform a point from source video pixels to canvas pixels.
 *
 * Two-stage transform matching CSS behavior:
 * 1. objectFit:cover + objectPosition → element-space coords
 * 2. transform:scale() from center (transform-origin: 50% 50%) → canvas coords
 */
export function sourceToCanvas(
  sourceX: number, sourceY: number,
  transform: CoverTransform,
  itemX = 0, itemY = 0,
): { x: number; y: number } {
  // Stage A: objectFit:cover + objectPosition
  const elementX = sourceX * transform.baseCoverScale - transform.offsetX;
  const elementY = sourceY * transform.baseCoverScale - transform.offsetY;
  // Stage B: CSS scale from center
  return {
    x: itemX + (elementX - transform.itemW / 2) * transform.cropScale + transform.itemW / 2,
    y: itemY + (elementY - transform.itemH / 2) * transform.cropScale + transform.itemH / 2,
  };
}

/**
 * Compute crop percentages that center a face in the item box.
 * Only adjusts objectPosition (crop.x/y), NOT crop.scale.
 * Handles division-by-zero when aspect ratios match exactly.
 */
export function computeCenterCrop(
  faceCenterX: number, faceCenterY: number,
  srcW: number, srcH: number,
  itemW: number, itemH: number,
): { x: number; y: number } {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const deltaW = renderedW - itemW;
  const deltaH = renderedH - itemH;
  const cropX = deltaW > 0.5
    ? (faceCenterX * baseCoverScale - itemW / 2) / deltaW * 100
    : 50;
  const cropY = deltaH > 0.5
    ? (faceCenterY * baseCoverScale - itemH / 2) / deltaH * 100
    : 50;
  return {
    x: Math.max(0, Math.min(100, cropX)),
    y: Math.max(0, Math.min(100, cropY)),
  };
}
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `packages/sandbox/template/src/items/resolveMediaSrc.ts` | Use `staticFile()` when `isRendering` |
| `packages/sandbox/src/prompts/orchestrator/system.md` | Remove phases 7 & 9, renumber, update progress phase list |
| `packages/sandbox/src/mcp-servers.ts` | Update progress phase description string (remove `reviewing`) |
| `packages/mcp-servers/src/asset-server.ts` | Replace `get_speaker_grid` with `get_speaker_position`, add `auto_center_speaker`, fix file path from `src/*/head_tracking.json` to `docs/speaker-grid.json` |
| `packages/mcp-servers/src/utils/cover-transform.ts` | New: shared cover transform math |
| `packages/sandbox/src/prompts/layout-editor/system.md` | Call `auto_center_speaker`, use `get_speaker_position` |
| `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md` | Update speaker-grid.json references to use tool |
| `packages/sandbox/src/prompts/final-editor/system.md` | Use `get_speaker_position` for overlay validation |
| `packages/sandbox/src/prompts/shared/manifest-tools.xml` | Update tool docs: `get_speaker_grid` → `get_speaker_position` |
| `packages/sandbox/template/.claude/CLAUDE.md` | Document `get_speaker_position` tool, update crop documentation |
| `packages/sandbox/src/workspace-init.ts` | Fix `headTracking` type to match actual data shape (raw detect_head.py output) |

---

## Out of Scope

- Multi-speaker detection (current detect_head.py tracks single speaker)
- Dynamic crop that follows speaker movement over time (per-frame crop keyframes)
- Re-running face detection with different parameters
- Changes to the Docker image build process
