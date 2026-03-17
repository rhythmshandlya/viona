# Plan D: Remove Template System — Three Creative Agents, One Manifest

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the template composition system so the player renders manifest items directly at their coordinates. Replace the predefined layout mode pipeline (`scenes.json` + `displayMode` enum + `FullComposition`) with three creative agents collaborating through one markdown plan and manifest tools.

**Architecture:**

The **Director** (planner) is a creative designer — it reads speaker data, head tracking, transcript, assets, content type, and user brief, then designs a complete spatial layout from scratch. It outputs `SCENE_PLAN.md` with natural language descriptions and exact build specs (scene file names, dimensions, coordinates, styles). Layout concepts like "stacked" or "PiP" are words in its creative vocabulary, not code variables — it can invent any arrangement.

The **Animator** creates scene `.tsx` files. It receives dimensions from the plan and has creative freedom in motion design — techniques, spring physics, color, composition within its canvas.

The **Editor** reads the plan and edits the manifest using tools. It has creative taste — it chooses transitions, adjusts timing for rhythm, handles audio/video track manipulation. It stitches everything together.

The **Player** is dumb — it iterates manifest items and renders each at its `transform` coordinates. No layout computation, no display modes.

**Tech Stack:** TypeScript (sandbox Node.js, Next.js frontend), ffmpeg, Remotion

**Spec Reference:** `docs/superpowers/plans/2026-03-16-pipeline-issues.md` — Issues 7, 8, 9, 10

---

## File Structure

### Files to modify:
- `packages/sandbox/src/workspace-init.ts` — Add ffmpeg audio extraction
- `packages/sandbox/template/src/PlayerComposition.tsx` — Rewrite as flat manifest renderer
- `packages/sandbox/template/src/composition/TransformWrapper.tsx` — Add `style` prop support
- `packages/sandbox/template/src/items/VideoItem.tsx` — Extract `resolveMediaSrc` helper
- `packages/sandbox/src/prompts/orchestrator-system.md` — Remove `scenes.json`, display mode enum, 3 animator variants; add editor manifest-editing pass
- `packages/sandbox/src/prompts/planner-system.md` — Remove `scenes.json` format; add spatial design system with head tracking, asset placement, composition principles
- `packages/sandbox/src/orchestrator.ts` — Remove 3 animator variants, remove `build_animator_dispatch`; single animator with dimensions from plan
- `packages/sandbox/src/prompt-assembly.ts` — Remove `computeEffectiveDimensions` / display mode logic
- `packages/sandbox/src/mcp-servers.ts` — Remove `build_animator_dispatch` tool
- `packages/sandbox/src/tools/manifest-ops.ts` — Add `style` support to `add_item` and `update_item`; extend `split_video` to work on audio items too
- `packages/api/src/sandbox/routes.ts` — Add audio item + muted video to initial manifest
- `apps/web/src/features/editor-v2/store/editor-store.ts` — Fix `splitItemInDraft` startFrom
- `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx` — Type-aware default transforms
- `apps/web/src/features/editor-v2/scene/Scene.tsx` — Click-to-select on canvas
- `apps/web/src/features/editor-v2/store/types.ts` — Remove `VisualDisplayMode`, `OverlayZone`, `displayMode` from `VisualItemData`
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` — Remove `displayMode` from visual/scene item serialization
- `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx` — Remove `layout_picker` widget case, remove `displayMode` from scene type
- `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx` — Remove `DisplayModeBadge`, display mode selector
- `apps/web/src/features/editor-v2/components/ContextPanel.tsx` — Remove display mode selector from visual properties
- `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx` — Remove "Change & AI Adapt" display mode submenu
- `packages/shared/src/types/index.ts` — Remove deprecated `DisplayMode` type, `LayoutTransitionType`
- `packages/shared/src/manifest.ts` — Remove `displayMode` from `visualItemDataSchema`
- `packages/shared/src/manifest-ops.ts` — Remove `set_display_mode` operation

### Files to DELETE:
- `packages/sandbox/template/src/composition/FullComposition.tsx`
- `packages/sandbox/template/src/composition/SpeakerVideo.tsx`
- `packages/sandbox/template/src/composition/PiPVideo.tsx`
- `packages/sandbox/template/src/composition/utils.ts`
- `packages/sandbox/template/src/composition/VisualsLayer.tsx`
- `apps/web/src/features/editor-v2/components/agent-widgets/LayoutPicker.tsx` — Entire component (predefined layout picker)

### Files NOT touched:
- `packages/sandbox/template/src/composition/SceneTransitionLayer.tsx` — May reuse later for scene-to-scene transitions
- `packages/sandbox/template/src/composition/animations/` — Animation system used by scene files
- `packages/sandbox/template/src/items/AudioItem.tsx` — Already renders `<Audio>` correctly
- `packages/sandbox/template/src/items/SceneItem.tsx` — Already does registry lookup
- `packages/sandbox/src/scene-registry-generator.ts` — Still needed for scene component lookup

---

## Chunk 1: Audio extraction + independent tracks

### Task 1: Extract audio from video at workspace-init

**Files:**
- Modify: `packages/sandbox/src/workspace-init.ts:108-124`

**Context:** `workspace-init.ts` downloads `source.mp4` (line 108-112) but never extracts audio. Audio only plays because Remotion's `<Video>` plays both streams — hiding the video kills the audio. Fix: after downloading the video, run ffmpeg to extract the audio track as a separate file.

- [ ] **Step 1: Add audio extraction after video download**

In `workspace-init.ts`, after the `probeVideoDurationMs` call (line 117) and before the `if (payload.audioUrl)` block (line 120), add:

```typescript
// Extract audio track from video for independent playback
const audioPath = join(WORKSPACE, 'public', 'audio.aac');
try {
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn',           // no video
    '-acodec', 'copy', // copy audio codec (no re-encode)
    '-y',            // overwrite
    audioPath,
  ]);
  logger.info('Audio extracted from video');
} catch (err) {
  logger.warn({ err }, 'ffmpeg audio extraction failed — falling back to video audio');
}
```

- [ ] **Step 2: Update the separate audio download to use consistent filename**

Change the `if (payload.audioUrl)` block output from `audio.mp3` to `audio.aac`:

```typescript
if (payload.audioUrl) {
  logger.info({ key: payload.audioUrl }, 'Downloading separate audio (overrides extracted)');
  const audioStream = await minio.getObject(bucket, payload.audioUrl);
  await pipeline(audioStream, createWriteStream(join(WORKSPACE, 'public', 'audio.aac')));
}
```

- [ ] **Step 3: Verify**

Run: `cd packages/sandbox && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (`execFileAsync` is already imported at line 11)

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/src/workspace-init.ts
git commit -m "feat: extract audio from video at workspace-init using ffmpeg (Issue 9)"
```

---

### Task 2: Add audio item + muted video to initial sandbox manifest

**Files:**
- Modify: `packages/api/src/sandbox/routes.ts:230-245`

**Context:** When the sandbox starts, the initial manifest has only a video item. We need to add an independent audio item and mute the video so audio/video tracks are independent from the start.

- [ ] **Step 1: Read the current manifest patching section**

Open `packages/api/src/sandbox/routes.ts` and read lines 230-245 where media `src` paths are overridden.

- [ ] **Step 2: Add audio item creation and video muting**

Replace the src override loop with:

```typescript
if (Array.isArray(manifest.items)) {
  let hasAudioItem = false;
  let videoDurationMs = 0;

  for (const item of manifest.items) {
    if (item.type === 'video' && item.data) {
      item.data.src = 'source.mp4';
      item.data.volume = 0; // Mute — audio comes from separate audio item
      videoDurationMs = item.endMs || manifest.durationMs || 0;
    } else if (item.type === 'audio' && item.data) {
      item.data.src = 'audio.aac';
      hasAudioItem = true;
    }
  }

  // Create independent audio item if none exists
  if (!hasAudioItem && videoDurationMs > 0) {
    const audioTrackId = crypto.randomUUID();
    if (Array.isArray(manifest.tracks)) {
      manifest.tracks.push({
        id: audioTrackId,
        type: 'audio',
        name: 'Speaker Audio',
        position: manifest.tracks.length,
      });
    }
    manifest.items.push({
      id: crypto.randomUUID(),
      type: 'audio',
      trackId: audioTrackId,
      startMs: 0,
      endMs: videoDurationMs,
      data: { src: 'audio.aac', volume: 1 },
    });
  }
}
```

- [ ] **Step 3: Verify + Commit**

```bash
cd packages/api && npx tsc --noEmit 2>&1 | head -20
git add packages/api/src/sandbox/routes.ts
git commit -m "feat: add independent audio item and mute video in initial sandbox manifest (Issue 9)"
```

---

## Chunk 2: Rewrite PlayerComposition as flat manifest renderer

### Task 3: Add `style` prop to TransformWrapper

**Files:**
- Modify: `packages/sandbox/template/src/composition/TransformWrapper.tsx:29-35,195-207`

**Context:** The planner may describe borders, rounded corners, shadows on any item region. `TransformWrapper` renders a `<div>` with absolute positioning — it just needs to spread an additional `style` object onto it.

- [ ] **Step 1: Add `style` to the props interface**

In `TransformWrapper.tsx`, update the props interface (line 29-35):

```typescript
interface TransformWrapperProps {
  transform: Transform;
  keyframes?: Keyframe[];
  filters?: Filters;
  fps: number;
  style?: React.CSSProperties; // Additional CSS (border, borderRadius, boxShadow, etc.)
  children: React.ReactNode;
}
```

- [ ] **Step 2: Spread style onto the div**

Update the component (line 173) to accept and spread the style prop:

```typescript
export const TransformWrapper: React.FC<TransformWrapperProps> = ({
  transform,
  keyframes,
  filters,
  fps,
  style: extraStyle,
  children,
}) => {
```

And update the style object (line 195-205):

```typescript
  const style: React.CSSProperties = {
    position: 'absolute',
    left: toCss(x),
    top: toCss(y),
    width: toCss(width),
    height: toCss(height),
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
    opacity,
    overflow: 'hidden',
    filter: filterStr !== 'none' ? filterStr : undefined,
    ...extraStyle, // borders, borderRadius, boxShadow, etc.
  };
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/composition/TransformWrapper.tsx
git commit -m "feat: add style prop to TransformWrapper for borders, shadows, radius"
```

---

### Task 4: Extract resolveMediaSrc helper from VideoItem

**Files:**
- Modify: `packages/sandbox/template/src/items/VideoItem.tsx:33-42`

**Context:** VideoItem has inline src resolution logic. Export it as `resolveMediaSrc` for reuse in the new PlayerComposition.

- [ ] **Step 1: Add exported helper**

At the top of `VideoItem.tsx`, after the imports, add:

```typescript
/** Resolve media source: assets map → URL → staticFile fallback */
export function resolveMediaSrc(src: string, assets: Record<string, string>): string {
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
```

- [ ] **Step 2: Refactor VideoItem to use it**

Replace the inline resolution (lines 36-42) with:

```typescript
const src = resolveMediaSrc(data.src, assets);
```

- [ ] **Step 3: Commit**

```bash
git add packages/sandbox/template/src/items/VideoItem.tsx
git commit -m "refactor: extract resolveMediaSrc helper from VideoItem"
```

---

### Task 5: Rewrite PlayerComposition.tsx

**Files:**
- Modify: `packages/sandbox/template/src/PlayerComposition.tsx` (full rewrite)

**Context:** The current PlayerComposition has two paths: FullComposition (with layout modes) and a fallback flat renderer. The rewrite makes the flat renderer the ONLY path — every item is rendered in a stack ordered by track position, each wrapped in `<Sequence>` + `<TransformWrapper>`.

- [ ] **Step 1: Rewrite PlayerComposition.tsx**

Replace the entire file with:

```tsx
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { TransformWrapper } from './composition/TransformWrapper';
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem } from './items';
import { sceneRegistry } from './scene-registry';

interface ManifestItem {
  id: string;
  type: string;
  trackId: string;
  startMs: number;
  endMs: number;
  data: any;
  transform?: any;
  keyframes?: any[];
  filters?: any;
  style?: React.CSSProperties;
}

interface ManifestTrack {
  id: string;
  type: string;
  name: string;
  position: number;
}

interface Manifest {
  version: number;
  fps: number;
  durationMs: number;
  canvas: { width: number; height: number };
  tracks: ManifestTrack[];
  items: ManifestItem[];
  assets: Record<string, string>;
  captionStyle?: any;
}

interface PlayerCompositionProps {
  manifest: Manifest;
}

const FULL_CANVAS_TRANSFORM = {
  x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1,
};

export const PlayerComposition: React.FC<PlayerCompositionProps> = ({ manifest }) => {
  const { fps, canvas, items, assets, captionStyle, durationMs } = manifest;
  const sortedTracks = [...manifest.tracks].sort((a, b) => a.position - b.position);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sortedTracks.map(track => {
        const trackItems = items
          .filter(item => item.trackId === track.id)
          .sort((a, b) => a.startMs - b.startMs);
        if (trackItems.length === 0) return null;

        return (
          <AbsoluteFill key={track.id}>
            {trackItems.map(item => {
              const startFrame = Math.round((item.startMs / 1000) * fps);
              const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));

              // Audio items don't need spatial transforms
              if (item.type === 'audio') {
                return (
                  <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  </Sequence>
                );
              }

              const transform = item.transform ?? FULL_CANVAS_TRANSFORM;
              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationInFrames} layout="none">
                  <TransformWrapper transform={transform} keyframes={item.keyframes} filters={item.filters} fps={fps} style={item.style}>
                    <ItemRenderer item={item} assets={assets} fps={fps} durationInFrames={durationInFrames} canvas={canvas} captionStyle={captionStyle} />
                  </TransformWrapper>
                </Sequence>
              );
            })}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

interface ItemRendererProps {
  item: ManifestItem;
  assets: Record<string, string>;
  fps: number;
  durationInFrames: number;
  canvas: { width: number; height: number };
  captionStyle?: any;
}

const ItemRenderer: React.FC<ItemRendererProps> = ({ item, assets, fps, durationInFrames, canvas, captionStyle }) => {
  switch (item.type) {
    case 'video':
      return <VideoItem data={item.data} assets={assets} fps={fps} durationInFrames={durationInFrames} />;
    case 'audio':
      return <AudioItem data={item.data} assets={assets} fps={fps} />;
    case 'text':
      return <TextItem data={item.data} />;
    case 'image':
      return <ImageItem data={item.data} assets={assets} />;
    case 'scene':
      return (
        <SceneItemComponent
          data={item.data}
          width={canvas.width}
          height={canvas.height}
          durationInFrames={durationInFrames}
          fps={fps}
          sceneRegistry={sceneRegistry}
        />
      );
    case 'shape':
      return <ShapeItem data={item.data} />;
    case 'caption':
      return <CaptionItem data={item.data} captionStyle={captionStyle || {}} fps={fps} itemStartMs={item.startMs} />;
    default:
      return null;
  }
};
```

- [ ] **Step 2: Verify + Commit**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
git add packages/sandbox/template/src/PlayerComposition.tsx
git commit -m "feat: rewrite PlayerComposition as flat manifest-driven renderer (Issues 8, 9, 10)"
```

---

### Task 6: Delete template composition files

**Files:**
- Delete: `FullComposition.tsx`, `SpeakerVideo.tsx`, `PiPVideo.tsx`, `utils.ts`, `VisualsLayer.tsx`
- Modify: `composition/types.ts` — remove template-only types (LayoutSegment, SplitSettings, DisplayMode, FullCompositionProps)
- Modify: `composition/index.ts` — remove re-exports of deleted files

- [ ] **Step 1: Delete files**

```bash
rm packages/sandbox/template/src/composition/FullComposition.tsx
rm packages/sandbox/template/src/composition/SpeakerVideo.tsx
rm packages/sandbox/template/src/composition/PiPVideo.tsx
rm packages/sandbox/template/src/composition/utils.ts
rm packages/sandbox/template/src/composition/VisualsLayer.tsx
```

- [ ] **Step 2: Clean up types.ts and index.ts**

Remove types only used by deleted files: `LayoutSegment`, `SplitSettings`, `LayoutMode`, `PiPSettings`, `VideoCropSettings`, `DisplayMode`, `FullCompositionProps`. Keep: `Rect`, `TransitionType`, `SceneTransition`, `SceneItem`, all subtitle/caption types.

Remove re-exports of deleted files from `index.ts`.

- [ ] **Step 3: Fix any remaining import errors**

Run: `cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -30`
Trace and fix any broken imports.

- [ ] **Step 4: Commit**

```bash
git add -A packages/sandbox/template/src/composition/
git commit -m "refactor: delete template layout system — FullComposition, SpeakerVideo, PiPVideo, utils, VisualsLayer (Issue 8)"
```

---

## Chunk 3: Three creative agents — new pipeline

### Task 7: Kill scenes.json — planner outputs only SCENE_PLAN.md

**Files:**
- Modify: `packages/sandbox/src/prompts/planner-system.md`

**Context:** The planner currently outputs two files: `SCENE_PLAN.md` (human-readable) and `scenes.json` (machine-readable with `displayMode` enum, `layout` field, segments/beats structure). We kill `scenes.json` entirely. The planner outputs only `SCENE_PLAN.md` — a detailed creative plan that serves as both the human document and the build spec.

- [ ] **Step 1: Read the current scenes.json format section**

In `planner-system.md`, read lines 503-605 — the `scenes.json v2 FORMAT` section.

- [ ] **Step 2: Remove the scenes.json format section entirely**

Delete lines 503-605 and the instruction to write `scenes.json` (line 11, line 57).

Change line 9-11 from:
```
Your job is to PLAN, not implement. You produce two files:
1. `/workspace/docs/SCENE_PLAN.md` — human-readable plan with full reasoning
2. `/workspace/scenes.json` — machine-readable for the Animator agent
```

To:
```
Your job is to PLAN, not implement. You produce one file:
- `/workspace/docs/SCENE_PLAN.md` — the complete creative plan with build specs

This file is read by the Orchestrator, Animators, and Editor. It must contain
enough spatial detail that each agent can do its job without guessing.
```

- [ ] **Step 3: Replace display mode rules with spatial design system**

Replace the `Speaker-Visible-by-Default` section (lines 90-97) and `Display Mode Rules` section (lines 157-215) with:

```markdown
## Spatial Design — Designing the Layout

You are a creative director designing a composition from available materials. You don't pick from predefined layouts — you DESIGN the spatial arrangement for each scene based on:

### Available Data (read before designing)

1. **Speaker video dimensions** — from canvas width/height in the brief
2. **Head tracking** (`/workspace/docs/speaker-grid.json`) — where the speaker's face is in the frame. Place animations where the face ISN'T.
3. **Transcript** (`/workspace/docs/transcript.json`) — timing, emotional peaks, key moments
4. **Media assets** — any logos, product screenshots, images the user provided. Note their dimensions.
5. **Content type** — ad, educational, brand story (from the brief)
6. **User brief** — explicit layout requests override your defaults

### Design Principles

- **One focal point per moment.** Either the speaker OR the animation dominates — never both competing.
- **Speaker face avoidance.** Use head tracking to find where the face is. Place animations in the opposite region.
- **Content type guides speaker visibility:**
  - Ads: speaker prominent (visible 60%+ of time), overlay-style with annotations
  - Educational: visuals prominent (60%+ of screen), speaker in smaller region
  - Brand story: varies by emotional beat
- **Canvas-aware sizing.** Portrait (1080×1920): stack vertically. Landscape (1920×1080): side by side. Square: speaker center, animations around edges.
- **Asset dimensions matter.** A wide product screenshot needs a wide region. A tall infographic needs a tall region. Don't force square assets into narrow strips.

### How to Specify Layout in SCENE_PLAN.md

For EVERY scene, specify:

1. **Scene files to create** — name and dimensions (width × height in pixels)
2. **Where each item goes** — {x, y, width, height} in canvas coordinates
3. **What happens to the video** — visible at what position/size, or hidden for this range
4. **Styling** — borders, borderRadius, shadows, background if needed
5. **Audio** — speaker voice continues, or muted, or music

Example:

```markdown
## Scene 3: The Comparison (5.2s - 8.4s)

Speaker stays in a horizontal band across the center — full width, 500px tall, centered vertically at y=710. Subtle white border (2px), rounded corners (16px).

**Scene files:**
- StatsComparison.tsx (1080 × 690) — stats chart, bar animation synced to "numbers speak"
- TestimonialScroll.tsx (1080 × 690) — testimonial cards scrolling upward

**Placement:**
- Video: {x: 0, y: 710, width: 1080, height: 500} — style: border 2px solid rgba(255,255,255,0.3), borderRadius 16px
- StatsComparison: {x: 0, y: 0, width: 1080, height: 690}
- TestimonialScroll: {x: 0, y: 1210, width: 1080, height: 690}

**Audio:** Speaker voice continues uninterrupted.
```

You can use familiar terms like "stacked", "PiP", "fullscreen" — they are words in your vocabulary, not code variables. But ALWAYS include the exact coordinates and dimensions. The executor needs numbers, not just words.

### When there's no brief

If the user says "just make it" or gives no layout guidance, design the layout yourself:

1. Read head tracking → find safe animation zones
2. Read transcript → identify emotional arc, key moments, content type
3. Read assets → note dimensions, what they depict
4. Apply content type heuristics:
   - **Ad:** Speaker prominent. Overlay-style for most beats. Fullscreen animations for hook and dramatic reveals.
   - **Educational:** Visuals prominent. Speaker in bottom 40%. Animations fill top 60%.
   - **Brand story:** Alternate between speaker-prominent and visual-prominent based on emotional beats.
5. Design layout with variety — don't use the same arrangement for every scene.
```

- [ ] **Step 4: Update the self-verification table**

Replace display-mode-based checks with:
```markdown
| Every scene has exact coordinates (x, y, width, height)? | | |
| Scene file dimensions match their placement region? | | |
| Speaker face not obscured by animation placement (check head tracking)? | | |
| Audio instructions specified for every scene? | | |
| No two adjacent scenes have identical layout? | | |
```

- [ ] **Step 5: Verify + Commit**

```bash
grep -c "scenes.json" packages/sandbox/src/prompts/planner-system.md  # should be 0
grep -c "displayMode" packages/sandbox/src/prompts/planner-system.md  # should be 0 or minimal
git add packages/sandbox/src/prompts/planner-system.md
git commit -m "feat: replace scenes.json + display modes with spatial design system in planner prompt (Issues 8, 9)"
```

---

### Task 8: Update orchestrator prompt — new pipeline with editor manifest pass

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

**Context:** The orchestrator currently reads `scenes.json` to build widgets (lines 120-132), dispatches 3 animator variants via `build_animator_dispatch` (lines 186-194), and has display mode validation (lines 139-146, 531-540). All of this changes.

- [ ] **Step 1: Update Phase 3 — planner returns only SCENE_PLAN.md**

Replace lines 108-149. The planner now returns only `SCENE_PLAN.md`. The orchestrator reads the markdown to build the widget:

```markdown
### Phase 3: Planning

Dispatch the **Planner** subagent. The Planner reads the transcript, does research, reads head tracking and asset data, and produces `/workspace/docs/SCENE_PLAN.md`.

**After the Planner returns:**
1. Read `/workspace/docs/SCENE_PLAN.md`
2. Parse the scene list from the markdown — each scene has: name, time range, scene file name, dimensions, placement coordinates, visual description
3. Build the widget data and show via `mcp__widgets__show_widget` with kind `"scene_plan"` and data `{ scenes: [...], scenePlanMarkdown: <full markdown> }`
4. STOP and wait for user approval.

**Validation (before showing to user):**
- Every scene has explicit coordinates (x, y, width, height)
- Scene file dimensions match their placement region
- No scene exceeds canvas bounds
- Time ranges are contiguous and cover the full duration
- If validation fails, tell the Planner to fix the specific issues
```

- [ ] **Step 2: Update Phase 4 — Editor reads plan + edits manifest**

The Editor now reads `SCENE_PLAN.md` and uses manifest tools to set up the spatial layout:

```markdown
### Phase 4: Editor Pass 1 — Rough Cut + Spatial Layout

Dispatch the **Editor**. The Editor reads `SCENE_PLAN.md` and the current manifest, then builds the spatial layout.

**What the Editor does:**
1. Reads the plan to understand the layout for each time range
2. **Splits the video item** at scene boundaries where the speaker should be hidden or repositioned
3. **Sets transforms** on video segments — position, size per the plan's coordinates
4. **Sets styles** on items — borders, borderRadius, shadows per the plan
5. **Creates placeholder scene items** with correct placement coordinates for each scene file (the scene .tsx files don't exist yet — these are placeholders)
6. Applies zoom crops to speaker footage where specified
7. Searches and places B-roll footage
8. Adds text overlays where specified

The Editor has creative taste — it adjusts timing for rhythm, makes micro-decisions about gaps and overlaps. But it follows the plan's spatial layout exactly.
```

- [ ] **Step 3: Update Phase 5 — Single animator type with dimensions from plan**

Replace the 3-variant dispatch with a single animator:

```markdown
### Phase 5: Animation Generation

Generate the animated scene files.

**Step 1 — Setup phase (Viona does directly):**
Create shared setup files (`constants.ts`, `Background.tsx`).

**Step 2 — Dispatch one Animator per scene file:**
For each scene file in the plan:
1. Read the plan to get: scene name, dimensions (width × height), visual description, sync points, duration
2. Dispatch the **Animator** with:
   - Scene file name (PascalCase)
   - Canvas dimensions for this scene (from the plan, NOT the full video canvas)
   - Visual description and sync points
   - Duration in frames
   - Theme

The Animator creates the `.tsx` file within the specified dimensions. It has creative freedom in motion design — techniques, spring physics, color, choreography. It does NOT know or care about the final placement on the video canvas.
```

- [ ] **Step 4: Update Phase 7 — Editor replaces placeholders and adds transitions**

```markdown
### Phase 7: Editor Pass 2 — Final Assembly

Re-dispatch the **Editor** for final assembly.

**What the Editor does:**
- Replaces placeholder scene items with real scene files (update `data.sceneFile`)
- Triggers rebuild
- Chooses transitions between scenes — the Editor has taste:
  - High energy → `slide-left` or `zoom` (200ms)
  - Emotional shift → `fade` (400ms)
  - Related content → `crossfade` (300ms)
  - Dramatic reveal → `morph` (500ms)
- Adds background music track (if available)
- Applies caption styling
- Final timing adjustments for rhythm
- Timeline integrity check — no gaps, no overlaps, all items have valid references
```

- [ ] **Step 5: Update Quality Standards — remove display mode rules**

Replace the "Speaker-Visible-by-Default" section (lines 531-540) with:

```markdown
### Speaker Visibility (CRITICAL)

The speaker is the viewer's trust anchor. The plan specifies when and where the speaker appears.

- **Hook:** Speaker must be visible. The plan should include the video item in the hook's layout.
- **Overall:** Speaker should be visible in 60-80% of the video duration (varies by content type — the plan determines this).
- **Max hidden duration:** Never hide the speaker for more than 15 consecutive seconds.

If the plan violates these guidelines, ask the Planner to revise before proceeding.
```

- [ ] **Step 6: Remove `build_animator_dispatch` references**

Remove all references to `mcp__widgets__build_animator_dispatch` and the 3 animator variant names (`animator-stacked`, `animator-fullscreen`, `animator-overlay`).

- [ ] **Step 7: Verify + Commit**

```bash
grep -c "scenes.json" packages/sandbox/src/prompts/orchestrator-system.md  # minimal
grep -c "build_animator_dispatch" packages/sandbox/src/prompts/orchestrator-system.md  # 0
grep -c "animator-stacked\|animator-fullscreen\|animator-overlay" packages/sandbox/src/prompts/orchestrator-system.md  # 0
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "feat: update orchestrator — single animator, editor manifest pass, no display modes (Issues 8, 9)"
```

---

### Task 9: Update orchestrator code — single animator, remove build_animator_dispatch

**Files:**
- Modify: `packages/sandbox/src/orchestrator.ts:164-223` — Replace 3 animator variants with one
- Modify: `packages/sandbox/src/prompt-assembly.ts` — Remove `computeEffectiveDimensions`
- Modify: `packages/sandbox/src/mcp-servers.ts:151-186` — Remove `build_animator_dispatch` tool

- [ ] **Step 1: Replace 3 animator variants with one**

In `orchestrator.ts`, replace lines 204-223:

```typescript
// Before: animator-stacked, animator-fullscreen, animator-overlay
// After: single animator
animator: {
  description: 'Writes Remotion .tsx scene files. Receives scene dimensions, visual brief, sync points. Has full creative freedom in motion design within its canvas.',
  prompt: animatorPrompt, // Single prompt, no display-mode-specific variants
  tools: ANIMATOR_TOOL_NAMES,
  model: 'opus',
},
```

- [ ] **Step 2: Update prompt assembly**

In `prompt-assembly.ts`, remove `computeEffectiveDimensions` function and the display-mode-specific prompt building logic. The animator prompt no longer needs effective dimensions baked in — they come from the dispatch message (which the orchestrator reads from the plan).

- [ ] **Step 3: Remove `build_animator_dispatch` from mcp-servers.ts**

Delete the tool definition at lines 151-186.

- [ ] **Step 4: Verify + Commit**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
git add packages/sandbox/src/orchestrator.ts packages/sandbox/src/prompt-assembly.ts packages/sandbox/src/mcp-servers.ts
git commit -m "refactor: single animator agent, remove build_animator_dispatch and display mode variants"
```

---

## Chunk 4: Fix video splits and editor frontend

### Task 10: Fix splitItemInDraft to adjust startFrom

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts:671-684`

**Context:** When splitting a video item, both halves get identical `data.startFrom`. The right half replays from the wrong source position.

- [ ] **Step 1: Add startFrom adjustment**

After the `rightItem` creation (line 677) and before trim handling (line 679), add:

```typescript
    // Adjust startFrom for media items so right half plays from correct source position
    if (original.type === 'video' || original.type === 'audio' || original.type === 'broll') {
      const currentStartFrom = (original.data as any).startFrom ?? 0;
      (rightItem.data as any).startFrom = currentStartFrom + splitRelativeMs;
    }
```

- [ ] **Step 2: Verify + Commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "fix: adjust startFrom on right half of video/audio splits (Issue 7B)"
```

---

### Task 11: Add `style` support to manifest tools

**Files:**
- Modify: `packages/sandbox/src/tools/manifest-ops.ts`

**Context:** The `add_item` and `update_item` tools need to support a `style` property so the Editor agent can set borders, borderRadius, shadows, etc. on manifest items.

- [ ] **Step 1: Add `style` to add_item schema**

In `addItemTool.input_schema.properties` (around line 248), add:

```typescript
style: {
  type: 'object',
  description: 'Optional CSS-like styling (border, borderRadius, boxShadow, background, overflow, etc.)',
},
```

In the execute function (line 275), add:

```typescript
if (input.style) item.style = input.style;
```

- [ ] **Step 2: Add `style` to update_item schema**

In `updateItemTool.input_schema.properties` (around line 302), add:

```typescript
style: {
  type: 'object',
  description: 'Partial style to deep-merge (border, borderRadius, boxShadow, etc.)',
},
```

In the execute function (line 336), add:

```typescript
if (input.style) item.style = { ...(item.style ?? {}), ...input.style };
```

- [ ] **Step 3: Extend split_video to work on audio items too**

In `splitVideoTool` (line 397), change the type check:

```typescript
// Before:
if (item.type !== 'video') return `Item ${input.itemId} is not a video`;

// After:
if (item.type !== 'video' && item.type !== 'audio') {
  return `Item ${input.itemId} is not a video or audio item (type: ${item.type})`;
}
```

Also ensure the right half gets adjusted `startFrom`:

```typescript
const splitRelativeMs = input.atMs - item.startMs;
const rightData = { ...item.data };
if (rightData.startFrom !== undefined || item.type === 'video' || item.type === 'audio') {
  rightData.startFrom = (item.data.startFrom ?? 0) + splitRelativeMs;
}
```

- [ ] **Step 4: Rename tool to `split_item` (optional but clearer)**

Consider renaming `split_video` → `split_item` since it now works on audio too. Update the tool name and all references.

- [ ] **Step 5: Verify + Commit**

```bash
cd packages/sandbox && npx tsc --noEmit --pretty false 2>&1 | head -20
git add packages/sandbox/src/tools/manifest-ops.ts
git commit -m "feat: add style support to manifest tools, extend split to audio items"
```

---

### Task 12: Fix ItemDragOverlay default transform + click-to-select

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx:34-41`
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx`

- [ ] **Step 1: Replace static DEFAULT_TRANSFORM with type-aware defaults**

In `ItemDragOverlay.tsx`, replace lines 34-41:

```typescript
function getDefaultTransform(itemType: string, canvasWidth: number, canvasHeight: number): Transform {
  switch (itemType) {
    case 'text':
      return { x: canvasWidth * 0.1, y: canvasHeight * 0.4, width: canvasWidth * 0.8, height: canvasHeight * 0.2, rotation: 0, opacity: 1 };
    case 'image':
      return { x: canvasWidth * 0.2, y: canvasHeight * 0.2, width: canvasWidth * 0.6, height: canvasHeight * 0.6, rotation: 0, opacity: 1 };
    default:
      return { x: 0, y: 0, width: canvasWidth, height: canvasHeight, rotation: 0, opacity: 1 };
  }
}
```

Update line 101:

```typescript
const transform = selectedItem.transform ?? getDefaultTransform(selectedItem.type, canvasWidth, canvasHeight);
```

- [ ] **Step 2: Add click-to-select on canvas**

In `Scene.tsx`, add a click handler to the player container that:
1. Gets click position relative to canvas (accounting for CSS zoom)
2. Finds visible items at current playhead time
3. Hit-tests each item's transform against click point
4. Selects the topmost matching item (highest track position)
5. Click on empty space deselects

```typescript
const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if ((e.target as HTMLElement).closest('[data-drag-overlay]')) return;
  const container = containerRef.current;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const scale = parseFloat(getComputedStyle(container).zoom || '1');
  const clickX = (e.clientX - rect.left) / scale;
  const clickY = (e.clientY - rect.top) / scale;

  const currentTimeMs = /* read from player/store */;
  const state = useEditorStore.getState();

  const visibleItems = state.itemIds
    .map(id => state.items[id])
    .filter(item => item && item.startMs <= currentTimeMs && item.endMs > currentTimeMs)
    .filter(item => !['audio', 'caption'].includes(item.type))
    .sort((a, b) => {
      const trackA = state.tracks.find(t => t.id === a.trackId);
      const trackB = state.tracks.find(t => t.id === b.trackId);
      return (trackB?.position ?? 0) - (trackA?.position ?? 0);
    });

  for (const item of visibleItems) {
    const t = item.transform ?? { x: 0, y: 0, width: state.videoSettings.canvasWidth, height: state.videoSettings.canvasHeight };
    const ix = typeof t.x === 'number' ? t.x : (parseFloat(t.x) / 100) * state.videoSettings.canvasWidth;
    const iy = typeof t.y === 'number' ? t.y : (parseFloat(t.y) / 100) * state.videoSettings.canvasHeight;
    const iw = typeof t.width === 'number' ? t.width : (parseFloat(t.width) / 100) * state.videoSettings.canvasWidth;
    const ih = typeof t.height === 'number' ? t.height : (parseFloat(t.height) / 100) * state.videoSettings.canvasHeight;

    if (clickX >= ix && clickX <= ix + iw && clickY >= iy && clickY <= iy + ih) {
      state.setSelectedIds([item.id]);
      return;
    }
  }
  state.setSelectedIds([]);
}, []);
```

- [ ] **Step 3: Verify + Commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx apps/web/src/features/editor-v2/scene/Scene.tsx
git commit -m "fix: type-aware default transforms + click-to-select on canvas (Issue 10)"
```

---

## Chunk 5: Frontend cleanup — remove display mode system

### Task 13: Remove VisualDisplayMode types and LayoutPicker component

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts:403-405,443,465,808`
- Delete: `apps/web/src/features/editor-v2/components/agent-widgets/LayoutPicker.tsx`
- Modify: `apps/web/src/features/editor-v2/components/agent-widgets/index.ts`

**Context:** The store types define `VisualDisplayMode`, `OverlayZone`, and include `displayMode` as a field on `VisualItemData`. The `LayoutPicker` widget offers users a choice between "PiP" and "Stacked" — predefined layout modes that no longer exist. The director now designs any layout from scratch.

**Note:** `CaptionDisplayMode` (`'word-by-word' | 'phrase' | 'karaoke'`) is UNRELATED to visual layout modes — it controls caption animation timing. Do NOT remove it.

- [ ] **Step 1: Remove visual display mode types from store/types.ts**

In `apps/web/src/features/editor-v2/store/types.ts`:

Delete:
```typescript
export type VisualDisplayMode = 'default' | 'fullscreen' | 'overlay';  // line 403

export type OverlayZone = 'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none';  // line 405
```

In `VisualItemData` interface (line 425), remove:
```typescript
  displayMode?: VisualDisplayMode;     // line 443
  overlayZone?: OverlayZone;           // line 445
  layout?: string;                      // line 465-466
```

Also remove `effectiveWidth` and `effectiveHeight` (lines 439-441) — these were display-mode-specific viewport overrides.

Remove the `changeDisplayModeWithAI` action from the store interface (line 808):
```typescript
changeDisplayModeWithAI: (itemId: string, newDisplayMode: VisualDisplayMode) => void;
```

Remove `normalizeDisplayMode` function (lines 914-918).

- [ ] **Step 2: Delete LayoutPicker component**

```bash
rm apps/web/src/features/editor-v2/components/agent-widgets/LayoutPicker.tsx
```

Remove the re-export from `index.ts`:
```typescript
// DELETE this line:
export { LayoutPicker } from './LayoutPicker';
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/components/agent-widgets/
git commit -m "refactor: remove VisualDisplayMode types and LayoutPicker component"
```

---

### Task 14: Remove display mode from editor store, context menu, and properties panel

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts:567,2567-2619`
- Modify: `apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx:253-278`
- Modify: `apps/web/src/features/editor-v2/components/ContextPanel.tsx:509-545`

**Context:** The editor store has `changeDisplayModeWithAI()` (lines 2567-2619) which builds an AI prompt to adapt scenes to new display modes. The context menu has a "Change & AI Adapt" submenu with Standard/Fullscreen/Overlay options. The ContextPanel shows a display mode selector with Standard/Full/Overlay in the visual properties section. All of these reference the display mode system being removed.

- [ ] **Step 1: Remove changeDisplayModeWithAI from editor-store.ts**

Delete the entire `changeDisplayModeWithAI` function (lines 2567-2619) and its `displayMode` parsing (line 567):

Replace line 567:
```typescript
// Before:
displayMode: (raw.displayMode as VisualDisplayMode) || undefined,
// After: (delete the line entirely)
```

Delete lines 2567-2619 (the `changeDisplayModeWithAI` function body).

Remove the `VisualDisplayMode` import if no longer used.

- [ ] **Step 2: Remove "Change & AI Adapt" submenu from context menu**

In `ContextMenu.tsx`, replace lines 253-278 (the display mode submenu block):

```typescript
// Before: submenu with Standard + Adapt / Fullscreen + Adapt / Overlay + Adapt
// After: just remove the display mode submenu entirely, keep the transition picker and Edit with AI
...(item?.type === 'visual'
  ? [
      { type: 'separator' as const },
      {
        label: 'Change Transition…',
        action: withSelection(() => openTransitionPicker(itemId)),
      },
      {
        label: 'Edit with AI',
        shortcut: 'E',
        action: withSelection(() => requestAIEdit(item)),
```

Remove the `changeDisplayModeWithAI` destructure from the store hook if present.

- [ ] **Step 3: Remove display mode selector from ContextPanel**

In `ContextPanel.tsx`, remove the "Display Mode" section (lines 534-545):

```tsx
// DELETE this entire Section:
<Section label="Display Mode">
  <SegmentedControl
    options={[
      { value: 'default', label: 'Standard' },
      { value: 'fullscreen', label: 'Full' },
      { value: 'overlay', label: 'Overlay' },
    ]}
    value={displayMode}
    onChange={() => {/* V2: layout is in AI-generated Composition.tsx */}}
  />
</Section>
```

Also remove the display mode parsing (lines 509-510):
```typescript
const rawDm = data.displayMode;
const displayMode = (!rawDm || (rawDm as string) === 'pip') ? 'default' : rawDm;
```

Remove the "Overlay Zone" section (lines 549-556) since `OverlayZone` is removed:
```tsx
// DELETE the Overlay Zone Section:
<Section label="Overlay Zone">
  <ZoneSelector ... />
</Section>
```

- [ ] **Step 4: Verify + Commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
git add apps/web/src/features/editor-v2/store/editor-store.ts apps/web/src/features/editor-v2/timeline/context-menu/ContextMenu.tsx apps/web/src/features/editor-v2/components/ContextPanel.tsx
git commit -m "refactor: remove display mode from editor store, context menu, and properties panel"
```

---

### Task 15: Remove display mode from manifest bridge, AI panel, and scene plan card

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts:29,587-590`
- Modify: `apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx:22,48,1565-1572,1607-1614`
- Modify: `apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx:42,99-122,343,518,533`

**Context:** The manifest bridge serializes `displayMode` when converting visual items to manifest format. The AI panel imports `LayoutPicker`, handles the `layout_picker` widget, and maps scene `displayMode` to widget types. The ScenePlanCard renders display mode badges and a selector. All removed.

- [ ] **Step 1: Remove displayMode from manifest-bridge.ts**

In `manifest-bridge.ts`, update the visual/scene case (lines 583-594):

```typescript
case 'visual':
case 'scene': {
  const result: Record<string, unknown> = {
    sceneFile: d.sourceSceneId != null ? `scenes/Scene${d.sourceSceneId}.tsx` : '',
    frameOffset: 0,
  };
  // Remove: displayMode: d.displayMode || 'default',
  // Remove: if (d.overlayZone) result.overlayZone = d.overlayZone;
  if (d.transition) result.transition = d.transition;
  if (d.speakerBbox) result.speakerBbox = d.speakerBbox;
  return result;
}
```

Remove the `VisualDisplayMode` import (line 29).

- [ ] **Step 2: Remove LayoutPicker and displayMode from AIAssistantPanel.tsx**

Remove `LayoutPicker` from the import (line 22):
```typescript
// Before:
import { ThemePicker, LayoutPicker, ScenePlanCard, ConfirmationWidget, ChoiceWidget } from './agent-widgets';
// After:
import { ThemePicker, ScenePlanCard, ConfirmationWidget, ChoiceWidget } from './agent-widgets';
```

Remove `displayMode` from the scene type definition (line 48):
```typescript
// Remove: displayMode?: 'default' | 'fullscreen' | 'overlay';
```

Remove the `layout_picker` case from the widget renderer (lines 1565-1572):
```typescript
// DELETE:
case 'layout_picker':
  return (
    <LayoutPicker
      onSelect={(layoutId) => handleWidgetResponse(widget.id, layoutId)}
      disabled={hasResponded || isStreaming}
      selectedValue={typeof response === 'string' ? response : undefined}
    />
  );
```

Remove the `displayMode` mapping in the scene plan widget builder (lines 1607-1614 — wherever `displayMode` from scenes is mapped to widget data).

- [ ] **Step 3: Remove display mode UI from ScenePlanCard.tsx**

Remove `DISPLAY_MODE_BADGE`, `DISPLAY_MODE_OPTIONS`, and `DisplayModeBadge` (lines 99-122).

Remove the `displayMode` field from the Scene interface (line 42).

Remove `DisplayModeBadge` rendering in the scene card (line 533).

Remove the display mode dropdown in the edit dialog (lines 518 and the `updateSceneDisplayMode` handler at line 343).

- [ ] **Step 4: Verify + Commit**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts apps/web/src/features/editor-v2/components/AIAssistantPanel.tsx apps/web/src/features/editor-v2/components/agent-widgets/ScenePlanCard.tsx
git commit -m "refactor: remove display mode from manifest bridge, AI panel, and scene plan card"
```

---

### Task 16: Remove display mode from shared types and manifest schemas

**Files:**
- Modify: `packages/shared/src/types/index.ts:322,325`
- Modify: `packages/shared/src/manifest.ts:19`
- Modify: `packages/shared/src/manifest-ops.ts:30-33,108-113`

**Context:** The shared package has deprecated `DisplayMode` and `LayoutTransitionType` types (lines 322, 325 in `types/index.ts`), a `displayMode` field in the visual item Zod schema (`manifest.ts` line 19), and a `set_display_mode` operation in `manifest-ops.ts`. All removed.

**Note:** `packages/shared/src/manifest-migrate.ts` has `V1VisualData` with `displayMode` and migration functions (`computePipTransform`, `computeStackedTransform`, `migrateVisualItem`). KEEP these — they are backward compatibility for migrating v1 manifests. Old projects need this to open.

- [ ] **Step 1: Remove deprecated types from shared/types/index.ts**

Delete:
```typescript
/** @deprecated v1 only — v2 uses segment-level layout in AI-generated Composition.tsx */
export type DisplayMode = 'default' | 'fullscreen' | 'overlay';  // line 322

export type LayoutTransitionType = 'cut' | 'fade' | 'zoom-in' | 'zoom-out';  // line 325
```

- [ ] **Step 2: Remove displayMode from manifest.ts visualItemDataSchema**

In `packages/shared/src/manifest.ts`, remove the `displayMode` field (line 19):
```typescript
// DELETE: displayMode: z.enum(['default', 'fullscreen', 'overlay']),
```

- [ ] **Step 3: Remove set_display_mode operation from manifest-ops.ts**

Delete the `set_display_mode` case from the `manifestOpSchema` union (lines 30-33):
```typescript
// DELETE:
z.object({
  op: z.literal('set_display_mode'),
  itemId: z.string(),
  displayMode: z.enum(['default', 'fullscreen', 'overlay']),
}),
```

Delete the `set_display_mode` handler in `applyManifestOp` (lines 108-113):
```typescript
// DELETE:
case 'set_display_mode': {
  const item = m.items.find(i => i.id === op.itemId);
  if (!item) throw new Error(`Item not found: ${op.itemId}`);
  if (item.type !== 'visual') throw new Error(`Item ${op.itemId} is not a visual`);
  (item.data as any).displayMode = op.displayMode;
  break;
}
```

- [ ] **Step 4: Verify + Commit**

```bash
cd packages/shared && npx tsc --noEmit 2>&1 | head -20
git add packages/shared/src/types/index.ts packages/shared/src/manifest.ts packages/shared/src/manifest-ops.ts
git commit -m "refactor: remove DisplayMode type, displayMode schema field, and set_display_mode operation from shared package"
```

---

### Task 17: Remove layout_picker widget from orchestrator prompt

**Files:**
- Modify: `packages/sandbox/src/prompts/orchestrator-system.md`

**Context:** The orchestrator prompt tells the AI to show a `layout_picker` widget so the user can choose between PiP and Stacked modes. This concept is gone — the director designs the layout, the user approves via the scene plan widget.

- [ ] **Step 1: Remove layout_picker references**

Search for `layout_picker` in `packages/sandbox/src/prompts/orchestrator-system.md` and remove any instructions to show this widget. The user approves the layout via the scene plan review, not by picking from a predefined list.

- [ ] **Step 2: Verify + Commit**

```bash
grep -c "layout_picker" packages/sandbox/src/prompts/orchestrator-system.md  # should be 0
git add packages/sandbox/src/prompts/orchestrator-system.md
git commit -m "fix: remove layout_picker widget from orchestrator prompt — layout is designed by director"
```

---

## What This Achieves

| Issue | Fix |
|-------|-----|
| **Issue 7**: Video blank at cuts | `splitItemInDraft` + `split_item` tool adjust `startFrom` correctly |
| **Issue 8**: Template limits creativity | Template system deleted. Three creative agents collaborate through one markdown plan + manifest tools. Any layout is possible. |
| **Issue 9**: Audio dies when video hidden | ffmpeg extracts audio at workspace-init. Independent audio + muted video tracks. Editor cuts video without affecting audio. |
| **Issue 10**: Can't move/resize items | All items have spatial transforms. Type-aware defaults. Click-to-select on canvas. |
| **Frontend cleanup**: Display mode system in editor | Remove `VisualDisplayMode` types, `LayoutPicker` widget, display mode selectors, `changeDisplayModeWithAI`, `set_display_mode` manifest op. Caption `displayMode` preserved (unrelated). |

## The Three Creative Agents

| Agent | Domain | Creative Freedom |
|-------|--------|-----------------|
| **Director (Planner)** | Vision, layout, storytelling | Designs any spatial arrangement from raw materials. Reads head tracking, assets, transcript. Invents layouts. |
| **Animator** | Motion design, visual effects | Full creative freedom within the dimensions it receives. Chooses techniques, spring physics, color, choreography. |
| **Editor** | Transitions, cuts, rhythm | Chooses transitions based on energy. Adjusts timing for flow. Makes micro-decisions about gaps and styling. Stitches everything together via manifest tools. |

## Known Tradeoffs

- **Scene-to-scene transitions simplified:** The old `SceneTransitionLayer` handled overlapping sequences for crossfade/slide transitions. The new flat renderer doesn't overlap scenes. Transitions between scenes can be re-added by extending the Editor to create overlapping time ranges on scene items, but for V1, transitions are CSS-based (opacity, transform) on individual items.

- **Planner must be precise:** The plan must contain exact coordinates. If the planner writes vague descriptions ("speaker somewhere in the middle"), execution quality degrades. The planner prompt explicitly requires coordinates for every item.

- **No backward compatibility with scenes.json:** Existing projects that have `scenes.json` will need the planner to re-run. There is no migration path from `scenes.json` → `SCENE_PLAN.md`.

- **Single animator prompt:** The 3 display-mode-specific prompts contained useful rules (e.g., overlay safe zones, fullscreen requires animated background). These need to be merged into the single animator prompt as conditional guidance — "if your canvas is full-screen, add an animated background."

- **Audio codec:** ffmpeg `acodec copy` extracts audio without re-encoding. If the source uses an unusual codec, it may fail. Fallback: change to `acodec aac` for re-encoding.
