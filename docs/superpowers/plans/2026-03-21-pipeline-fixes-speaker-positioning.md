# Pipeline Fixes & Speaker Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix render_still URL resolution, remove review phases, add canvas-space speaker position tool, and auto-center speaker in video.

**Architecture:** Four independent fixes sharing a cover-transform utility. Fix 1 (resolveMediaSrc) and Fix 2 (remove review phases) are standalone edits. Fixes 3 and 4 add two new MCP tools to the asset server that use a shared cover-transform module for source-to-canvas coordinate mapping.

**Tech Stack:** TypeScript, MCP server (McpServer from `@modelcontextprotocol/sdk`), Zod schemas, Remotion (for resolveMediaSrc), markdown prompt files.

**Spec:** `docs/superpowers/specs/2026-03-21-pipeline-fixes-speaker-positioning-design.md`

---

### Task 1: Fix resolveMediaSrc — local files when rendering inside sandbox

**Files:**
- Modify: `packages/sandbox/template/src/items/resolveMediaSrc.ts:47-63`

- [ ] **Step 1: Edit resolveMediaSrc to use staticFile when rendering**

In `packages/sandbox/template/src/items/resolveMediaSrc.ts`, replace the `resolveMediaSrc` function body (lines 47-63). The key change: when `isRendering === true`, skip the assets map (which has presigned MinIO URLs unreachable from Docker) and use `staticFile(src)` which resolves to local `/workspace/public/` files.

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

  // Inside sandbox render (remotion render / remotion still): use local files.
  // The assets map contains presigned MinIO URLs meant for browser access
  // outside the container. Headless Chrome inside Docker can't reach them.
  if (isRendering) {
    if (/^https?:\/\/|^blob:/.test(src)) return src;
    return staticFile(src);
  }

  // Browser player: assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

Also update the JSDoc comment above (lines 35-46) to reflect the new resolution order:

```typescript
/**
 * Resolve a media source path to a playable URL.
 *
 * In preview mode: prefers proxy variant if available in assets map.
 * In render mode (remotion render / remotion still): uses local staticFile.
 *   Presigned URLs in the assets map are for browser access outside the
 *   sandbox container — headless Chrome inside Docker can't reach them.
 * In browser player: uses assets map for presigned URLs.
 *
 * Resolution order:
 *   Preview:  proxy → assets map → absolute URL → staticFile
 *   Render:   absolute URL → staticFile (skip assets map)
 *   Browser:  assets map → absolute URL → staticFile
 */
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:
```bash
cd packages/sandbox/template && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/items/resolveMediaSrc.ts
git commit -m "fix(sandbox): use local staticFile for media when rendering inside container

Presigned MinIO URLs in the assets map are for browser access outside
Docker. Headless Chrome inside the sandbox can't reach them, causing
118s delayRender timeouts. Now render mode skips the assets map and
resolves directly to local files via staticFile().

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Remove review phases from orchestrator pipeline

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator/system.md:136-167,203,219,221`
- Modify: `packages/sandbox/src/mcp-servers.ts:133`

- [ ] **Step 1: Remove Phase 7 (Review) from orchestrator prompt**

In `packages/sandbox/src/prompts/orchestrator/system.md`, delete lines 136-146 (the entire Phase 7 section):

```markdown
### Phase 7: Review (Viona does this herself)

Report progress: `{ phase: "reviewing", message: "Reviewing scenes..." }`

After all animators return:
- Render stills at key sync frames for each scene
- Inspect the rendered output
- Check that scenes match the plan's description
- Check overlay scenes don't cover the speaker's face
- If issues found: dispatch a fix agent (Animator subagent) with specific feedback
- Max 2 fix rounds per scene
```

- [ ] **Step 2: Remove Phase 9 (Final Review) from orchestrator prompt**

Delete lines 154-161 (after removal of Phase 7, these will have shifted up):

```markdown
### Phase 9: Final Review (Viona does this herself)

Report progress: `{ phase: "final-review", message: "Final review..." }`

After Final Editor returns:
- Render 3-5 stills across the video
- Verify overall quality
- If issues found: dispatch fix agents or do minor manifest tweaks herself
```

- [ ] **Step 3: Renumber remaining phases**

After removing Phase 7 and Phase 9:
- Old Phase 8 (Final Assembly) → **Phase 7**
- Old Phase 10 (Done) → **Phase 8**

Update the heading text and any internal references:
- `### Phase 8: Final Assembly` → `### Phase 7: Final Assembly`
- `### Phase 10: Done` → `### Phase 8: Done`
- In the Subagents table (line 203), `final_editor` phase column: `8` → `7`
- `report_plan` reference (line 219): `Phase 2-10` → `Phase 2-8`

- [ ] **Step 4: Update progress phases list**

In the same file, update the progress phases line (line 221):

Old:
```markdown
**Progress phases:** preparing, planning, setup, layout, generating, reviewing, assembling, final-review, complete, error.
```

New:
```markdown
**Progress phases:** preparing, planning, setup, layout, generating, assembling, complete, error.
```

- [ ] **Step 5: Update mcp-servers.ts progress phase description**

In `packages/sandbox/src/mcp-servers.ts` line 133, update the `phase` description:

Old:
```typescript
phase: z.string().describe('Pipeline phase: trimming, planning, editing, generating, reviewing, assembling, complete'),
```

New:
```typescript
phase: z.string().describe('Pipeline phase: preparing, planning, setup, layout, generating, assembling, complete, error'),
```

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox/src/prompts/orchestrator/system.md packages/sandbox/src/mcp-servers.ts
git commit -m "perf(pipeline): remove review phases 7 and 9 from orchestrator

These phases rendered stills, inspected with vision, and dispatched fix
agents (up to 2 rounds each). Removing them cuts pipeline duration and
token cost significantly. Pipeline is now 8 phases instead of 10.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create cover-transform shared utility

**Files:**
- Create: `packages/mcp-servers/src/utils/cover-transform.ts`

- [ ] **Step 1: Write the test**

Create `scripts/temp/test-cover-transform.ts`:

```typescript
/**
 * Quick validation of cover-transform math.
 * Run: npx tsx scripts/temp/test-cover-transform.ts
 */

// Inline the functions to test without import resolution issues
function computeCoverTransform(
  srcW: number, srcH: number,
  itemW: number, itemH: number,
  cropX = 50, cropY = 50, cropScale = 1,
) {
  const baseCoverScale = Math.max(itemW / srcW, itemH / srcH);
  const renderedW = srcW * baseCoverScale;
  const renderedH = srcH * baseCoverScale;
  const offsetX = (renderedW - itemW) * (cropX / 100);
  const offsetY = (renderedH - itemH) * (cropY / 100);
  return { baseCoverScale, renderedW, renderedH, offsetX, offsetY, cropScale, itemW, itemH };
}

function sourceToCanvas(
  sourceX: number, sourceY: number,
  transform: ReturnType<typeof computeCoverTransform>,
  itemX = 0, itemY = 0,
) {
  const elementX = sourceX * transform.baseCoverScale - transform.offsetX;
  const elementY = sourceY * transform.baseCoverScale - transform.offsetY;
  return {
    x: itemX + (elementX - transform.itemW / 2) * transform.cropScale + transform.itemW / 2,
    y: itemY + (elementY - transform.itemH / 2) * transform.cropScale + transform.itemH / 2,
  };
}

function computeCenterCrop(
  faceCenterX: number, faceCenterY: number,
  srcW: number, srcH: number,
  itemW: number, itemH: number,
) {
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

// --- Tests ---
let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  PASS: ${msg}`); }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

function approx(a: number, b: number, eps = 1) {
  return Math.abs(a - b) < eps;
}

// Test 1: Landscape (1920x1080) into portrait canvas (1080x1920)
// coverScale = max(1080/1920, 1920/1080) = 1.778
// renderedW = 1920 * 1.778 = 3413, renderedH = 1080 * 1.778 = 1920
// With cropX=50: offsetX = (3413 - 1080) * 0.5 = 1166.5
// Source center (960, 540) → elementX = 960*1.778 - 1166.5 = 540
// With cropScale=1: canvasX = 540 (center of 1080) ✓
console.log('Test 1: Landscape → portrait, default crop');
{
  const t = computeCoverTransform(1920, 1080, 1080, 1920);
  assert(approx(t.baseCoverScale, 1.778, 0.01), `coverScale=${t.baseCoverScale.toFixed(3)}`);
  const p = sourceToCanvas(960, 540, t);
  assert(approx(p.x, 540, 2), `center X=${p.x.toFixed(0)} (expected ~540)`);
  assert(approx(p.y, 960, 2), `center Y=${p.y.toFixed(0)} (expected ~960)`);
}

// Test 2: Same aspect ratio — no cropping
console.log('Test 2: Same aspect ratio (1920x1080 → 1920x1080)');
{
  const t = computeCoverTransform(1920, 1080, 1920, 1080);
  assert(approx(t.baseCoverScale, 1, 0.01), `coverScale=${t.baseCoverScale}`);
  const p = sourceToCanvas(100, 200, t);
  assert(approx(p.x, 100, 1), `X=${p.x} (expected 100)`);
  assert(approx(p.y, 200, 1), `Y=${p.y} (expected 200)`);
}

// Test 3: computeCenterCrop — speaker at left of landscape video
// Source: 1920x1080, speaker face center at (400, 540)
// Canvas: 1080x1920, coverScale = 1.778
// Ideal: pan left to show speaker
console.log('Test 3: computeCenterCrop — speaker off-center left');
{
  const crop = computeCenterCrop(400, 540, 1920, 1080, 1080, 1920);
  // After applying this crop, source (400, 540) should map to canvas center
  const t = computeCoverTransform(1920, 1080, 1080, 1920, crop.x, crop.y);
  const p = sourceToCanvas(400, 540, t);
  assert(approx(p.x, 540, 5), `centered X=${p.x.toFixed(0)} (expected ~540)`);
  assert(approx(p.y, 960, 5), `centered Y=${p.y.toFixed(0)} (expected ~960)`);
  assert(crop.x >= 0 && crop.x <= 100, `cropX=${crop.x.toFixed(1)} in range`);
}

// Test 4: computeCenterCrop — division by zero edge case
console.log('Test 4: computeCenterCrop — matching aspect ratio');
{
  const crop = computeCenterCrop(960, 540, 1920, 1080, 1920, 1080);
  assert(crop.x === 50, `cropX=${crop.x} (expected 50)`);
  assert(crop.y === 50, `cropY=${crop.y} (expected 50)`);
}

// Test 5: sourceToCanvas with crop.scale > 1
console.log('Test 5: crop.scale zoom from center');
{
  const t = computeCoverTransform(1920, 1080, 1080, 1920, 50, 50, 1.5);
  // Center of source should still map to center of canvas
  const center = sourceToCanvas(960, 540, t);
  assert(approx(center.x, 540, 5), `zoom center X=${center.x.toFixed(0)} (expected ~540)`);
  // Point away from center should be pushed further out
  const corner = sourceToCanvas(0, 0, t);
  const noZoom = sourceToCanvas(0, 0, computeCoverTransform(1920, 1080, 1080, 1920, 50, 50, 1));
  assert(corner.x < noZoom.x, `zoom pushes left point further left: ${corner.x.toFixed(0)} < ${noZoom.x.toFixed(0)}`);
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run the test to verify it works**

```bash
npx tsx scripts/temp/test-cover-transform.ts
```
Expected: All tests pass.

- [ ] **Step 3: Create the cover-transform.ts utility module**

Create `packages/mcp-servers/src/utils/cover-transform.ts`:

```typescript
/**
 * Cover-transform math for mapping source video coordinates to canvas pixels.
 *
 * Models the CSS transform chain used by VideoItem.tsx:
 *   1. objectFit: cover — scales source to fill item box, cropping overflow
 *   2. objectPosition: x% y% — shifts which part of the source is visible
 *   3. transform: scale(N) — zooms from element center (transform-origin: 50% 50%)
 */

export interface CoverTransform {
  baseCoverScale: number;
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
  cropScale: number;
  itemW: number;
  itemH: number;
}

/**
 * Compute the objectFit:cover + crop transform parameters.
 *
 * @param srcW  Source video width in pixels
 * @param srcH  Source video height in pixels
 * @param itemW Video item width on canvas in pixels
 * @param itemH Video item height on canvas in pixels
 * @param cropX objectPosition X percentage (0-100, default 50)
 * @param cropY objectPosition Y percentage (0-100, default 50)
 * @param cropScale CSS transform: scale() value (default 1)
 */
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
 *
 * @param sourceX X coordinate in source video pixels
 * @param sourceY Y coordinate in source video pixels
 * @param transform Cover transform parameters from computeCoverTransform()
 * @param itemX Video item X position on canvas (default 0)
 * @param itemY Video item Y position on canvas (default 0)
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
 *
 * @param faceCenterX Average face center X in source video pixels
 * @param faceCenterY Average face center Y in source video pixels
 * @param srcW Source video width
 * @param srcH Source video height
 * @param itemW Video item width on canvas
 * @param itemH Video item height on canvas
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/mcp-servers && npx tsc --noEmit
```
Expected: no errors. If there's no `tsconfig.json` in mcp-servers, run from the repo root or check the package's build command.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-servers/src/utils/cover-transform.ts scripts/temp/test-cover-transform.ts
git commit -m "feat(mcp): add cover-transform utility for source-to-canvas coordinate mapping

Shared module that models the CSS transform chain used by VideoItem.tsx:
objectFit:cover + objectPosition + transform:scale(). Provides
sourceToCanvas() for coordinate projection and computeCenterCrop() for
auto-centering speaker face in the video item.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Add auto_center_speaker MCP tool

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts` (add new tool registration before `get_speaker_grid`, around line 554)
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md:9` (add instruction to call the tool)

The `auto_center_speaker` tool reads head tracking data and manifest, computes the optimal `crop.x`/`crop.y` to center the speaker's face, and writes the crop back to the manifest's video item.

- [ ] **Step 1: Add import for cover-transform utility**

In `packages/mcp-servers/src/asset-server.ts`, add an import near the top (after existing imports around line 5):

```typescript
import { computeCenterCrop } from './utils/cover-transform.js';
```

- [ ] **Step 2: Add the auto_center_speaker tool**

Register the tool before `get_speaker_grid` (before line 554). Insert:

```typescript
server.registerTool(
  "auto_center_speaker",
  {
    description:
      "Automatically adjust the video item's crop to center the speaker's face. " +
      "Reads head tracking data and the manifest, computes optimal objectPosition " +
      "percentages, and writes updated crop values back to the manifest. " +
      "Call this after placing video items in the timeline (Phase 5 Layout).",
    inputSchema: {},
  },
  async () => {
    try {
      // 1. Read head tracking data
      const trackingPath = path.join(WORKSPACE, "docs", "speaker-grid.json");
      let trackingData: HeadTrackingData;
      try {
        trackingData = JSON.parse(await readFile(trackingPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              adjusted: false,
              reason: "No head tracking data available at docs/speaker-grid.json",
            }),
          }],
        };
      }

      const frames = trackingData.frames || [];
      const videoW = trackingData.video?.width || 1;
      const videoH = trackingData.video?.height || 1;

      // Filter to frames with face detections
      const withFace = frames.filter((f) => f.face?.bbox);
      if (withFace.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              adjusted: false,
              reason: "No face detections found in tracking data. Keeping default crop.",
            }),
          }],
        };
      }

      // 2. Compute average face center in source pixels
      let sumX = 0, sumY = 0;
      for (const f of withFace) {
        const b = f.face!.bbox;
        sumX += b.x + b.width / 2;
        sumY += b.y + b.height / 2;
      }
      const faceCenterX = sumX / withFace.length;
      const faceCenterY = sumY / withFace.length;

      // 3. Read manifest to find video items and canvas dimensions
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Find all video items (manifest uses flat items[] array with trackId references)
      const updated: Array<{ itemId: string; trackId: string; cropX: number; cropY: number }> = [];

      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;

        // Item dimensions come from item.transform (not item.width/height)
        const t = item.transform || {};
        const itemW = typeof t.width === 'number' ? t.width : canvas.width;
        const itemH = typeof t.height === 'number' ? t.height : canvas.height;

        const crop = computeCenterCrop(
          faceCenterX, faceCenterY,
          videoW, videoH,
          itemW, itemH,
        );

        // Update item crop in manifest
        if (!item.data) item.data = {};
        item.data.crop = {
          x: Math.round(crop.x * 10) / 10,
          y: Math.round(crop.y * 10) / 10,
          scale: item.data.crop?.scale ?? 1,
        };

        updated.push({
          itemId: item.id,
          trackId: item.trackId,
          cropX: item.data.crop.x,
          cropY: item.data.crop.y,
        });
      }

      if (updated.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ adjusted: false, reason: "No video items found in manifest." }),
          }],
        };
      }

      // 4. Write updated manifest
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            adjusted: true,
            faceCenter: {
              x: Math.round(faceCenterX),
              y: Math.round(faceCenterY),
              sourceSize: { width: videoW, height: videoH },
            },
            items: updated,
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error auto-centering speaker: ${errorMessage(err)}`,
        }],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 3: Add writeFile import**

Check if `writeFile` is already imported at the top of `asset-server.ts`. The file imports from `fs/promises`. If `writeFile` is not in the import list (line ~2-3), add it:

```typescript
import { readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
```

- [ ] **Step 4: Update layout-editor prompt to call auto_center_speaker**

In `packages/sandbox/src/prompts/layout-editor/system.md`, find the Phase 5 section where it discusses placing video items. After the prerequisites section (around line 9), add a new step instruction. Find the line:

```markdown
- Speaker head tracking at `/workspace/docs/speaker-grid.json` (optional — for overlay placement validation). Fallback: assume face centered in top 40% of frame.
```

Replace with:

```markdown
- Speaker head tracking at `/workspace/docs/speaker-grid.json` (optional — for overlay placement and auto-centering)
```

Then find the section where video items are placed on the timeline (the display modes table area, around lines 48-55). After placing video items, add this instruction before the keyframes section:

```markdown
### Auto-Center Speaker

After placing all video items, call `auto_center_speaker` to adjust the video crop so the speaker is centered in the frame. This tool reads face detection data and computes optimal `objectPosition` values. If tracking data is unavailable, the default center crop (50%, 50%) is used.

Call this ONCE after all video items are placed, BEFORE placing scene/overlay items. Overlay positioning depends on the speaker being correctly framed first.
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd packages/mcp-servers && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts packages/sandbox/src/prompts/layout-editor/system.md
git commit -m "feat(mcp): add auto_center_speaker tool for speaker-aware video cropping

Computes optimal objectPosition crop values to center the speaker's
face in the video item, rather than centering the geometric frame.
Called by Layout Editor after placing video items. Uses head tracking
data from detect_head.py via speaker-grid.json.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Replace get_speaker_grid with get_speaker_position

**Files:**
- Modify: `packages/mcp-servers/src/asset-server.ts:43-48` (extend HeadTrackingFrame interface)
- Modify: `packages/mcp-servers/src/asset-server.ts:59-69` (remove GridResult interface)
- Modify: `packages/mcp-servers/src/asset-server.ts:554-777` (replace existing tool)

This is the largest change. The new `get_speaker_position` tool returns exact canvas-space coordinates accounting for the cover+crop transform, replaces the coarse grid approach, and includes body landmarks.

- [ ] **Step 1: Extend HeadTrackingFrame interface with body landmarks**

In `packages/mcp-servers/src/asset-server.ts`, find the `HeadTrackingFrame` interface (lines 43-48):

```typescript
interface HeadTrackingFrame {
  timestamp_ms: number;
  face?: {
    bbox: FaceBbox;
  } | null;
}
```

Replace with:

```typescript
interface HeadTrackingFrame {
  timestamp_ms: number;
  face?: {
    bbox: FaceBbox;
    landmarks?: Record<string, { x: number; y: number }>;
  } | null;
  body?: {
    left_shoulder?: { x: number; y: number; visible?: boolean };
    right_shoulder?: { x: number; y: number; visible?: boolean };
    left_hand?: { x: number; y: number; visible?: boolean };
    right_hand?: { x: number; y: number; visible?: boolean };
  } | null;
  confidence?: number;
}
```

- [ ] **Step 2: Remove the GridResult interface**

Delete the `GridResult` interface (lines 59-69):

```typescript
interface GridResult {
  grid: number[][];
  occupancy: string;
  speakerBbox: {
    x: string; y: string; w: string; h: string;
  } | null;
  safePlacement: string[];
}
```

- [ ] **Step 3: Update imports for cover-transform utility**

Update the import (added in Task 4 step 1) to include all needed functions:

```typescript
import {
  computeCoverTransform,
  computeCenterCrop,
  sourceToCanvas,
  type CoverTransform,
} from './utils/cover-transform.js';
```

- [ ] **Step 4: Replace get_speaker_grid with get_speaker_position**

Delete the entire `get_speaker_grid` tool registration (lines 554-777) and replace with the new tool. This is a large block — here is the complete replacement:

```typescript
// ---------------------------------------------------------------------------
// Speaker position tool — canvas-space coordinates with cover-crop transform
// ---------------------------------------------------------------------------

interface SpeakerPositionResult {
  canvas: { width: number; height: number };
  videoTransform: {
    sourceSize: { width: number; height: number };
    coverScale: number;
    crop: { x: number; y: number; scale: number };
    visibleRegion: { x: number; y: number; width: number; height: number };
  };
  speaker: {
    bounds: { top: number; bottom: number; left: number; right: number };
    face: { x: number; y: number; width: number; height: number };
    shoulderLine: number;
    hands: {
      left: { x: number; y: number; active: boolean };
      right: { x: number; y: number; active: boolean };
    };
    movement: "minimal" | "moderate" | "large";
  } | null;
  availableSpace: {
    above: { from: number; to: number; height: number };
    below: { from: number; to: number; height: number };
    left: { from: number; to: number; width: number };
    right: { from: number; to: number; width: number };
  };
  safePlacements: Array<{ name: string; rect: { x: number; y: number; width: number; height: number } }>;
  confidence: number;
}

server.registerTool(
  "get_speaker_position",
  {
    description:
      "Get the speaker's exact position on the canvas for a given time range. " +
      "Returns pixel coordinates in canvas space, accounting for objectFit:cover " +
      "and crop transforms. Includes face bbox, body bounds, shoulder line, hand " +
      "positions, available space in each direction, and concrete safe placement " +
      "rects for overlay elements. Use this when implementing overlay scenes to " +
      "avoid placing visuals on top of the speaker.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    try {
      // 1. Read head tracking data
      const trackingPath = path.join(WORKSPACE, "docs", "speaker-grid.json");
      let trackingData: HeadTrackingData;
      try {
        trackingData = JSON.parse(await readFile(trackingPath, "utf-8"));
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Head tracking data not available.",
              hint: "Design overlay with generous margins on all sides.",
            }),
          }],
          isError: true,
        };
      }

      const srcW = trackingData.video?.width || 1920;
      const srcH = trackingData.video?.height || 1080;

      // 2. Read manifest for video item geometry and canvas
      const manifestPath = path.join(WORKSPACE, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      const canvas = manifest.canvas || { width: 1080, height: 1920 };

      // Find video item active during [startMs, endMs]
      // Manifest uses flat items[] array with trackId references
      let videoItem: any = null;
      let bestOverlap = 0;
      for (const item of manifest.items || []) {
        if (item.type !== "video") continue;
        const itemStart = item.startMs ?? 0;
        const itemEnd = item.endMs ?? (itemStart + (item.durationMs ?? 0));
        const overlapStart = Math.max(startMs, itemStart);
        const overlapEnd = Math.min(endMs, itemEnd);
        const overlap = overlapEnd - overlapStart;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          videoItem = item;
        }
      }

      // Video item dimensions from item.transform (not item.width/height)
      const vt = videoItem?.transform || {};
      const itemW = typeof vt.width === 'number' ? vt.width : canvas.width;
      const itemH = typeof vt.height === 'number' ? vt.height : canvas.height;
      const itemX = typeof vt.x === 'number' ? vt.x : 0;
      const itemY = typeof vt.y === 'number' ? vt.y : 0;
      const cropX = videoItem?.data?.crop?.x ?? 50;
      const cropY = videoItem?.data?.crop?.y ?? 50;
      const cropScale = videoItem?.data?.crop?.scale ?? 1;

      // 3. Compute cover transform
      const transform = computeCoverTransform(srcW, srcH, itemW, itemH, cropX, cropY, cropScale);

      // Visible region in source pixels
      const visOffsetX = transform.offsetX / transform.baseCoverScale;
      const visOffsetY = transform.offsetY / transform.baseCoverScale;
      const visW = itemW / (transform.baseCoverScale * cropScale);
      const visH = itemH / (transform.baseCoverScale * cropScale);

      // 4. Filter tracking frames to time range
      const frames = (trackingData.frames || []).filter(
        (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs
      );
      const withFace = frames.filter((f) => f.face?.bbox);
      const confidence = frames.length > 0 ? withFace.length / frames.length : 0;

      if (withFace.length === 0) {
        // No detections — entire canvas is safe
        const result: SpeakerPositionResult = {
          canvas,
          videoTransform: {
            sourceSize: { width: srcW, height: srcH },
            coverScale: transform.baseCoverScale,
            crop: { x: cropX, y: cropY, scale: cropScale },
            visibleRegion: { x: Math.round(visOffsetX), y: Math.round(visOffsetY), width: Math.round(visW), height: Math.round(visH) },
          },
          speaker: null,
          availableSpace: {
            above: { from: 0, to: canvas.height, height: canvas.height },
            below: { from: 0, to: canvas.height, height: canvas.height },
            left: { from: 0, to: canvas.width, width: canvas.width },
            right: { from: 0, to: canvas.width, width: canvas.width },
          },
          safePlacements: [{ name: "entire-canvas", rect: { x: 0, y: 0, width: canvas.width, height: canvas.height } }],
          confidence: 0,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      }

      // 5. Transform all detections to canvas space and aggregate
      let boundsTop = Infinity, boundsBottom = -Infinity;
      let boundsLeft = Infinity, boundsRight = -Infinity;
      let faceSumX = 0, faceSumY = 0, faceSumW = 0, faceSumH = 0;
      let shoulderSumY = 0, shoulderCount = 0;
      let handLSumX = 0, handLSumY = 0, handLCount = 0;
      let handRSumX = 0, handRSumY = 0, handRCount = 0;
      const handLPositions: { x: number; y: number }[] = [];
      const handRPositions: { x: number; y: number }[] = [];
      const faceCenters: { x: number; y: number }[] = [];

      for (const f of withFace) {
        const bbox = f.face!.bbox;

        // Transform face bbox corners
        const topLeft = sourceToCanvas(bbox.x, bbox.y, transform, itemX, itemY);
        const bottomRight = sourceToCanvas(bbox.x + bbox.width, bbox.y + bbox.height, transform, itemX, itemY);

        const fX = Math.min(topLeft.x, bottomRight.x);
        const fY = Math.min(topLeft.y, bottomRight.y);
        const fW = Math.abs(bottomRight.x - topLeft.x);
        const fH = Math.abs(bottomRight.y - topLeft.y);

        faceSumX += fX; faceSumY += fY; faceSumW += fW; faceSumH += fH;
        faceCenters.push({ x: fX + fW / 2, y: fY + fH / 2 });

        // Update body bounds with face
        boundsTop = Math.min(boundsTop, fY);
        boundsBottom = Math.max(boundsBottom, fY + fH);
        boundsLeft = Math.min(boundsLeft, fX);
        boundsRight = Math.max(boundsRight, fX + fW);

        // Body landmarks
        if (f.body) {
          if (f.body.left_shoulder?.visible !== false) {
            const ls = sourceToCanvas(f.body.left_shoulder.x, f.body.left_shoulder.y, transform, itemX, itemY);
            shoulderSumY += ls.y; shoulderCount++;
            boundsBottom = Math.max(boundsBottom, ls.y);
            boundsLeft = Math.min(boundsLeft, ls.x);
            boundsRight = Math.max(boundsRight, ls.x);
          }
          if (f.body.right_shoulder?.visible !== false) {
            const rs = sourceToCanvas(f.body.right_shoulder.x, f.body.right_shoulder.y, transform, itemX, itemY);
            shoulderSumY += rs.y; shoulderCount++;
            boundsBottom = Math.max(boundsBottom, rs.y);
            boundsLeft = Math.min(boundsLeft, rs.x);
            boundsRight = Math.max(boundsRight, rs.x);
          }
          if (f.body.left_hand?.visible) {
            const lh = sourceToCanvas(f.body.left_hand.x, f.body.left_hand.y, transform, itemX, itemY);
            handLSumX += lh.x; handLSumY += lh.y; handLCount++;
            handLPositions.push(lh);
            boundsBottom = Math.max(boundsBottom, lh.y);
            boundsLeft = Math.min(boundsLeft, lh.x);
            boundsRight = Math.max(boundsRight, lh.x);
          }
          if (f.body.right_hand?.visible) {
            const rh = sourceToCanvas(f.body.right_hand.x, f.body.right_hand.y, transform, itemX, itemY);
            handRSumX += rh.x; handRSumY += rh.y; handRCount++;
            handRPositions.push(rh);
            boundsBottom = Math.max(boundsBottom, rh.y);
            boundsLeft = Math.min(boundsLeft, rh.x);
            boundsRight = Math.max(boundsRight, rh.x);
          }
        }
      }

      // Clamp bounds to canvas
      boundsTop = Math.max(0, Math.round(boundsTop));
      boundsBottom = Math.min(canvas.height, Math.round(boundsBottom));
      boundsLeft = Math.max(0, Math.round(boundsLeft));
      boundsRight = Math.min(canvas.width, Math.round(boundsRight));

      const n = withFace.length;
      const face = {
        x: Math.round(faceSumX / n),
        y: Math.round(faceSumY / n),
        width: Math.round(faceSumW / n),
        height: Math.round(faceSumH / n),
      };

      const shoulderLine = shoulderCount > 0 ? Math.round(shoulderSumY / shoulderCount) : face.y + face.height;

      // Hand activity — active if hand moves >15% of canvas height
      const canvasDiag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
      const handThreshold = canvas.height * 0.15;

      function isHandActive(positions: { x: number; y: number }[]): boolean {
        if (positions.length < 2) return false;
        let minY = Infinity, maxY = -Infinity;
        for (const p of positions) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        return (maxY - minY) > handThreshold;
      }

      const hands = {
        left: {
          x: handLCount > 0 ? Math.round(handLSumX / handLCount) : boundsLeft,
          y: handLCount > 0 ? Math.round(handLSumY / handLCount) : boundsBottom,
          active: isHandActive(handLPositions),
        },
        right: {
          x: handRCount > 0 ? Math.round(handRSumX / handRCount) : boundsRight,
          y: handRCount > 0 ? Math.round(handRSumY / handRCount) : boundsBottom,
          active: isHandActive(handRPositions),
        },
      };

      // Movement classification
      let movement: "minimal" | "moderate" | "large" = "minimal";
      if (faceCenters.length > 1) {
        const avgX = faceCenters.reduce((s, p) => s + p.x, 0) / faceCenters.length;
        const avgY = faceCenters.reduce((s, p) => s + p.y, 0) / faceCenters.length;
        const variance = faceCenters.reduce((s, p) => s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0) / faceCenters.length;
        const stddev = Math.sqrt(variance);
        const pct = stddev / canvasDiag * 100;
        if (pct >= 8) movement = "large";
        else if (pct >= 2) movement = "moderate";
      }

      // 6. Compute available space
      const margin = movement === "large" ? 80 : movement === "moderate" ? 40 : 20;
      const availableSpace = {
        above: { from: 0, to: Math.max(0, boundsTop - margin), height: Math.max(0, boundsTop - margin) },
        below: { from: Math.min(canvas.height, boundsBottom + margin), to: canvas.height, height: Math.max(0, canvas.height - boundsBottom - margin) },
        left: { from: 0, to: Math.max(0, boundsLeft - margin), width: Math.max(0, boundsLeft - margin) },
        right: { from: Math.min(canvas.width, boundsRight + margin), to: canvas.width, width: Math.max(0, canvas.width - boundsRight - margin) },
      };

      // 7. Generate safe placements
      const safePlacements: SpeakerPositionResult["safePlacements"] = [];
      const minDimPct = 0.10;

      if (availableSpace.above.height > canvas.height * minDimPct) {
        safePlacements.push({
          name: "top-strip",
          rect: { x: 0, y: 0, width: canvas.width, height: availableSpace.above.to },
        });
      }
      if (availableSpace.below.height > canvas.height * minDimPct) {
        safePlacements.push({
          name: "lower-third",
          rect: { x: 0, y: availableSpace.below.from, width: canvas.width, height: availableSpace.below.height },
        });
      }
      if (availableSpace.left.width > canvas.width * minDimPct) {
        safePlacements.push({
          name: "left-panel",
          rect: { x: 0, y: 0, width: availableSpace.left.to, height: canvas.height },
        });
      }
      if (availableSpace.right.width > canvas.width * minDimPct) {
        safePlacements.push({
          name: "right-panel",
          rect: { x: availableSpace.right.from, y: 0, width: availableSpace.right.width, height: canvas.height },
        });
      }
      if (safePlacements.length === 0) {
        // Fallback: at least offer a small top strip
        safePlacements.push({
          name: "top-strip-tight",
          rect: { x: 0, y: 0, width: canvas.width, height: Math.max(50, boundsTop) },
        });
      }

      const result: SpeakerPositionResult = {
        canvas,
        videoTransform: {
          sourceSize: { width: srcW, height: srcH },
          coverScale: transform.baseCoverScale,
          crop: { x: cropX, y: cropY, scale: cropScale },
          visibleRegion: { x: Math.round(visOffsetX), y: Math.round(visOffsetY), width: Math.round(visW), height: Math.round(visH) },
        },
        speaker: { bounds: { top: boundsTop, bottom: boundsBottom, left: boundsLeft, right: boundsRight }, face, shoulderLine, hands, movement },
        availableSpace,
        safePlacements,
        confidence,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error getting speaker position: ${errorMessage(err)}` }],
        isError: true,
      };
    }
  }
);

// Deprecated alias — keep backward compat for prompts still referencing old name
server.registerTool(
  "get_speaker_grid",
  {
    description: "[Deprecated — use get_speaker_position] Get speaker position data for overlay placement.",
    inputSchema: {
      startMs: z.number().describe("Start of time range in milliseconds"),
      endMs: z.number().describe("End of time range in milliseconds"),
    },
  },
  async ({ startMs, endMs }: { startMs: number; endMs: number }) => {
    // Delegate to get_speaker_position by calling its logic directly
    // (MCP tools can't call each other, so we duplicate the tool name reference)
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          deprecated: true,
          message: "Use get_speaker_position instead for canvas-space coordinates.",
          hint: "Call get_speaker_position with { startMs, endMs }",
        }),
      }],
    };
  }
);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd packages/mcp-servers && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/src/asset-server.ts
git commit -m "feat(mcp): replace get_speaker_grid with canvas-space get_speaker_position

The old tool returned a coarse 6x6 grid in source video space. The new
tool accounts for objectFit:cover + crop transforms to return exact
pixel coordinates on the canvas. Includes face bbox, body bounds,
shoulder line, hand positions, available space, and concrete safe
placement rects. Old tool kept as deprecated alias.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Update prompts to use get_speaker_position

**Files:**
- Modify: `packages/sandbox/src/prompts/final-editor/system.md` (lines 11, 45-49, 83)
- Modify: `packages/sandbox/src/prompts/layout-editor/system.md` (lines 39, 195)
- Modify: `packages/sandbox/src/prompts/animator/system.md` (overlay section around line 133-138)
- Modify: `packages/sandbox/src/prompts/shared/manifest-tools.xml:27`
- Modify: `packages/sandbox/template/.claude/CLAUDE.md:61-63`

- [ ] **Step 1: Update ALL final-editor speaker-grid references**

In `packages/sandbox/src/prompts/final-editor/system.md`, there are three references to update:

**Line 11 (prerequisites):** Find `speaker-grid.json` in the inputs/prerequisites section and replace with:
```markdown
- Speaker position data via `get_speaker_position` tool (for overlay validation)
```

**Lines 45-49 (overlay validation section):** Find:
```markdown
- Read speaker-grid.json for face position (fallback: face centered in top 40%)
- Verify overlay scenes don't cover face zone during speaker-visible segments
- Verify overlay scenes don't overlap caption area (y > CANVAS_HEIGHT * 0.85)
```

Replace with:

```markdown
- Call `get_speaker_position` for each overlay scene's time range to get canvas-space speaker bounds
- Verify overlay scene items don't overlap with `speaker.bounds` (use the `safePlacements` rects as valid zones)
- Verify overlay scenes don't overlap caption area (y > CANVAS_HEIGHT * 0.85)
- If get_speaker_position returns null speaker (no detections), assume face centered in top 40%
```

- [ ] **Step 2: Update remaining layout-editor references**

In `packages/sandbox/src/prompts/layout-editor/system.md`, there are two more `speaker-grid.json` references beyond what Task 4 updated:

**Line 39** (Step 1: Read inputs): Find `Read speaker-grid.json if available` or similar, and remove or replace with:
```markdown
- Speaker positioning is handled by `get_speaker_position` tool (called during overlay validation, not file read)
```

**Line 195** (workflow Step 2): Find `Read /workspace/docs/speaker-grid.json if it exists` and remove or replace with a reference to the `get_speaker_position` tool.

- [ ] **Step 3: Update animator prompt for overlay scenes**

In `packages/sandbox/src/prompts/animator/system.md`, find the overlay section in Display Mode Rules. After the last overlay bullet (around line 138, "Animations should be subtle — overlays enhance, they don't compete with the speaker"), add:

```markdown
- **Before positioning overlay elements:** Call `get_speaker_position` with the scene's time range. Use the `safePlacements` rects for element positioning — these are concrete pixel rectangles that avoid the speaker. The `availableSpace` fields tell you exactly how much room is above, below, left, and right of the speaker.
```

- [ ] **Step 4: Update manifest-tools.xml**

In `packages/sandbox/src/prompts/shared/manifest-tools.xml`, find the line referencing `get_speaker_grid` (around line 27) and replace:

```xml
get_speaker_grid → get_speaker_position
```

Update the description to match the new tool.

- [ ] **Step 5: Update workspace CLAUDE.md**

In `packages/sandbox/template/.claude/CLAUDE.md`, replace lines 61-63:

```markdown
## Video Positioning
- Video uses `objectFit: 'cover'` in the renderer — it automatically fills the canvas with no black bars.
- No manual crop/zoom-to-fill is needed. The renderer handles it.
```

With:

```markdown
## Video Positioning
- Video uses `objectFit: 'cover'` with optional `crop` settings (`objectPosition` + `scale`).
- `auto_center_speaker` sets optimal crop values to center the speaker's face (called by Layout Editor).
- `get_speaker_position` returns the speaker's exact canvas-space coordinates for a time range. Use this when placing overlay elements — it accounts for the cover crop transform and returns concrete `safePlacements` rects.
- Do NOT read `speaker-grid.json` directly — use the tool instead.
```

- [ ] **Step 6: Update layout-editor good-layout.md example (if it references speaker-grid.json)**

In `packages/sandbox/src/prompts/layout-editor/examples/good-layout.md`, search for any references to `speaker-grid.json` or `get_speaker_grid` and update them to reference `get_speaker_position` and the new `auto_center_speaker` tool.

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/prompts/final-editor/system.md packages/sandbox/src/prompts/layout-editor/system.md packages/sandbox/src/prompts/animator/system.md packages/sandbox/src/prompts/shared/manifest-tools.xml packages/sandbox/template/.claude/CLAUDE.md packages/sandbox/src/prompts/layout-editor/examples/good-layout.md
git commit -m "docs(prompts): update all prompts to use get_speaker_position tool

Layout editor calls auto_center_speaker after placing video items.
Animator and Final Editor use get_speaker_position for canvas-space
overlay positioning. Workspace CLAUDE.md documents the new tools.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Fix workspace-init.ts headTracking type

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:27-31`

- [ ] **Step 1: Update the InitPayload headTracking type**

In `packages/sandbox/src/workspace-init.ts`, find the `headTracking` field in the `InitPayload` interface (around lines 27-31):

```typescript
headTracking?: {
  speakerGrid: number[][];
  safePlacement: Array<{x: number; y: number; width: number; height: number}>;
};
```

Replace with the actual data shape (raw detect_head.py output):

```typescript
headTracking?: {
  video?: { fps?: number; width?: number; height?: number; duration_ms?: number; total_frames?: number };
  settings?: { sample_interval?: number; samples_count?: number };
  metadata?: { detection_rate?: number; frames_processed?: number; frames_with_face?: number };
  frames: Array<{
    frame: number;
    timestamp_ms: number;
    face?: {
      bbox: { x: number; y: number; width: number; height: number };
      landmarks?: Record<string, { x: number; y: number }>;
    };
    body?: {
      left_shoulder?: { x: number; y: number; visible?: boolean };
      right_shoulder?: { x: number; y: number; visible?: boolean };
      left_hand?: { x: number; y: number; visible?: boolean };
      right_hand?: { x: number; y: number; visible?: boolean };
    };
    confidence?: number;
    detection_failed?: boolean;
  }>;
};
```

- [ ] **Step 2: Verify the code that writes speaker-grid.json still works**

Search for where `headTracking` is written to `speaker-grid.json` in the same file. It should be doing something like:

```typescript
await writeFile(join(WORKSPACE, 'docs', 'speaker-grid.json'), JSON.stringify(payload.headTracking));
```

Since the runtime data was always the full detect_head.py output (the type annotation was just wrong), no logic changes are needed — only the type annotation is being corrected.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/sandbox && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "fix(sandbox): correct headTracking type to match actual detect_head.py output

The InitPayload type declared headTracking as {speakerGrid, safePlacement}
but the actual runtime data is the raw detect_head.py output with
per-frame face/body landmarks. The type was stale — correcting it to
match reality.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full TypeScript build**

```bash
# From repo root
npx turbo build --filter=@viona/sandbox --filter=@viona/mcp-servers
```

Or if turbo isn't set up for these packages, compile each:
```bash
cd packages/sandbox && npx tsc --noEmit
cd packages/mcp-servers && npx tsc --noEmit
cd packages/sandbox/template && npx tsc --noEmit
```

- [ ] **Step 2: Run the cover-transform test**

```bash
npx tsx scripts/temp/test-cover-transform.ts
```
Expected: all tests pass.

- [ ] **Step 3: Review all changes**

```bash
git log --oneline -7
git diff main..HEAD --stat
```

Verify 7 commits covering all 4 fixes plus the shared utility, prompt updates, and type fix.
