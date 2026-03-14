# AI-Driven Composition Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded layout modes with AI-generated composition code — the Animator writes the full Remotion composition (video placement, subtitle rendering, segment assembly) inline, guided by an example in its prompt.

**Architecture:** Director groups consecutive same-layout beats into segments. Animator generates one animation file per segment + a `Composition.tsx` that assembles everything (video, segments, subtitles) using inline Remotion code. The `composition/` template directory is deleted. Codegen becomes a thin wrapper importing the AI-generated composition.

**Tech Stack:** TypeScript, React, Remotion, Python (visual generator pipeline), BullMQ, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-03-13-ai-composition-generation-design.md`

---

## File Structure

### Files to Create
- `packages/worker/src/prompts/director/segment-grouping.md` — Director prompt addition for segment grouping rules
- `packages/worker/src/prompts/animator/composition-assembly.md` — Animator prompt addition with example Composition.tsx

### Files to Modify
- `packages/worker/src/prompts/director/system.md` — Reference new segment-grouping rules
- `packages/worker/src/prompts/animator/system.md` — Reference new composition-assembly prompt, change scene→segment terminology
- `packages/worker/src/processors/plan-visuals.ts` — Parse segments from Director output
- `packages/worker/src/processors/generate-visuals/index.ts` — Create timeline items per segment, compute segment dimensions
- `packages/worker/src/processors/generate-visuals/types.ts` — Update metadata types for segments
- `packages/worker/src/processors/generate-visuals/subprocess.ts` — Pass segment-aware args to Python generator
- `packages/worker/src/processors/edit-visuals/editor.ts` — Expand scope to Composition.tsx + segments/
- `packages/worker/src/processors/edit-visuals/context.ts` — Update layout context builder for segments
- `packages/worker/src/agents/visual_generator/_pipeline.py` — Update pipeline for segments/ directory structure
- `packages/worker/src/agents/visual_generator/_validators.py` — Update scene plan validator for segments format
- `packages/api/src/workspace/workspace-codegen.ts` — Replace with thin wrapper codegen
- `packages/api/src/agent/agent-tools.ts` — Remove set_layout, set_display_mode tools
- `apps/web/src/features/editor-v2/store/types.ts` — Simplify VisualItemData, remove layout types
- `apps/web/src/features/editor-v2/store/editor-store.ts` — Remove layout settings/actions

### Files to Delete
- `packages/worker/remotion-template/src/composition/FullComposition.tsx`
- `packages/worker/remotion-template/src/composition/SpeakerVideo.tsx`
- `packages/worker/remotion-template/src/composition/PiPVideo.tsx`
- `packages/worker/remotion-template/src/composition/VisualsLayer.tsx`
- `packages/worker/remotion-template/src/composition/SceneTransitionLayer.tsx`
- `packages/worker/remotion-template/src/composition/SubtitleLayer.tsx`
- `packages/worker/remotion-template/src/composition/AnimatedSubtitle.tsx`
- `packages/worker/remotion-template/src/composition/utils.ts`
- `packages/worker/remotion-template/src/composition/types.ts`
- `packages/worker/remotion-template/src/composition/index.ts`

---

## Chunk 1: Director + Animator Prompts

### Task 1: Create Director segment-grouping prompt module

**Files:**
- Create: `packages/worker/src/prompts/director/segment-grouping.md`
- Modify: `packages/worker/src/prompts/director/system.md`

- [ ] **Step 1: Create segment-grouping.md**

Create `packages/worker/src/prompts/director/segment-grouping.md`:

```markdown
## Segment Grouping Rules

After planning individual beats, you MUST group them into **segments** before writing scenes.json.

### What is a segment?
A segment is a group of consecutive beats that share the same layout type. One animation file will be generated per segment — motion flows continuously within a segment, no hard cuts.

### Grouping rules:
1. Consecutive beats with the **same layout type** are grouped into one segment
2. A **layout change** = new segment = new animation file
3. Beats within a segment are narrative markers — the animator treats them as moments in continuous motion

### Layout types and their props:

**stacked** — Video + visuals split vertically
```json
{ "splitRatio": 70, "position": "video-first" }
```
- `splitRatio`: 0-100, percentage of canvas for video (70 = video takes 70%, visuals 30%)
- `position`: `"video-first"` (video on top) or `"visuals-first"` (visuals on top)

**overlay** — Visuals floating on top of full video
```json
{ "x": "10%", "y": "60%", "width": "40%", "height": "35%" }
```
- CSS percentage positions/dimensions for the visual overlay region

**fullscreen** — Visuals fill entire canvas, audio only (no video shown)
```json
{}
```
- No props needed — visuals take the full canvas

### Output format

scenes.json MUST use version 2 format with `segments` array (NOT flat `scenes` array):

```json
{
  "version": 2,
  "fps": 30,
  "totalFrames": 1500,
  "segments": [
    {
      "id": 1,
      "layout": "stacked",
      "layoutProps": { "splitRatio": 70, "position": "video-first" },
      "frames": [0, 720],
      "beats": [
        { "id": 1, "name": "Hook", "frames": [0, 360], "visual": "...", "syncPoints": [...] },
        { "id": 2, "name": "Problem", "frames": [360, 720], "visual": "...", "syncPoints": [...] }
      ]
    }
  ]
}
```

### Self-verification before writing scenes.json:
- [ ] Every beat is assigned to exactly one segment
- [ ] Consecutive beats in the same segment share the same layout type
- [ ] Layout changes always start a new segment
- [ ] Each segment has valid `layoutProps` for its layout type
- [ ] `frames` arrays are contiguous (segment N end = segment N+1 start)
- [ ] Beat frames are relative to video timeline (absolute), NOT segment-relative
```

- [ ] **Step 2: Update system.md to reference segment-grouping**

In `packages/worker/src/prompts/director/system.md`, find the section where it describes the `scenes.json` output format. Add a reference line:

```markdown
{{load: segment-grouping.md}}
```

This should replace or augment the existing `scenes.json` format documentation. The exact insertion point depends on the current file structure — insert it near the scenes.json output specification section.

- [ ] **Step 3: Remove display-mode-table.md reference**

In `packages/worker/src/prompts/director/system.md`, remove or replace the `{{load: display-mode-table.md}}` reference since `displayMode` per scene is replaced by segment-level `layout`.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/prompts/director/segment-grouping.md packages/worker/src/prompts/director/system.md
git commit -m "feat(director): add segment grouping prompt rules for scenes.json v2"
```

---

### Task 2: Create Animator composition-assembly prompt module

**Files:**
- Create: `packages/worker/src/prompts/animator/composition-assembly.md`
- Modify: `packages/worker/src/prompts/animator/system.md`

- [ ] **Step 1: Create composition-assembly.md**

Create `packages/worker/src/prompts/animator/composition-assembly.md` with the example composition and rules. This is the key prompt that teaches the Animator to write the full composition:

```markdown
## Composition Assembly

After generating all segment animation files, you MUST create `Composition.tsx` — the file that assembles segments, video, and subtitles into the final composition.

### Directory structure you produce:

```
segments/
  Segment1.tsx   (continuous animation for segment 1)
  Segment2.tsx   (continuous animation for segment 2)
  ...
Composition.tsx  (assembles everything)
constants.ts     (colors, spring configs)
components/      (shared components if needed)
```

### Segment component contract:

Every segment component receives `width` and `height` props matching its container:

```tsx
interface SegmentProps {
  width: number;
  height: number;
}

export const Segment1: React.FC<SegmentProps> = ({ width, height }) => {
  const frame = useCurrentFrame(); // 0-relative within this segment
  // ...
};
```

### CRITICAL RULES:

1. **Audio carrier (MANDATORY):** Render a persistent hidden `<OffthreadVideo>` (1x1 pixel, opacity 0) OUTSIDE all `<Sequence>` blocks. Without this, audio glitches at every segment boundary.

2. **Muted per-segment video:** All VISIBLE `<OffthreadVideo>` elements inside Sequences MUST use `muted` prop. Audio comes ONLY from the carrier.

3. **Root-level subtitles:** Render subtitles at root level using absolute `currentTimeMs`, NOT inside Sequences. This avoids the 0-relative frame offset bug.

4. **Segment dimension props:** Pass `width` and `height` to each segment matching its container size.

5. **Frame timing:** Inside `<Sequence>`, `useCurrentFrame()` returns 0-relative frames. Segment animations use relative frame numbers (0 to segment duration).

### Example Composition.tsx:

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { Segment1 } from './segments/Segment1';
import { Segment2 } from './segments/Segment2';
import { Segment3 } from './segments/Segment3';

export const Composition: React.FC<{
  videoUrl: string;
  subtitles: { startMs: number; endMs: number; words: { text: string; startMs: number; endMs: number }[] }[];
  captionStyle?: { fontFamily?: string; fontSize?: number; color?: string };
}> = ({ videoUrl, subtitles, captionStyle }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const currentTimeMs = (frame / fps) * 1000;

  const videoH70 = Math.round(height * 0.7);
  const visualsH30 = height - videoH70;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* CRITICAL: Persistent audio carrier */}
      <OffthreadVideo
        src={videoUrl}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />

      {/* Segment 1: stacked 70/30 — video top, visuals bottom */}
      <Sequence from={0} durationInFrames={720}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height: videoH70, overflow: 'hidden' }}>
          <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', top: videoH70, width, height: visualsH30, overflow: 'hidden' }}>
          <Segment1 width={width} height={visualsH30} />
        </div>
      </Sequence>

      {/* Segment 2: fullscreen visuals, audio only */}
      <Sequence from={720} durationInFrames={360}>
        <Segment2 width={width} height={height} />
      </Sequence>

      {/* Segment 3: overlay visuals on full video */}
      <Sequence from={1080} durationInFrames={420}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
          <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', left: '10%', top: '60%', width: '40%', height: '35%' }}>
          <Segment3 width={Math.round(width * 0.4)} height={Math.round(height * 0.35)} />
        </div>
      </Sequence>

      {/* Subtitles — root level, absolute timestamps */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 40px 80px' }}>
        {subtitles.map((subtitle, i) => {
          if (currentTimeMs < subtitle.startMs || currentTimeMs > subtitle.endMs) return null;
          return (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 8px' }}>
              {subtitle.words.map((word, j) => {
                const isActive = currentTimeMs >= word.startMs;
                return (
                  <span key={j} style={{
                    fontSize: captionStyle?.fontSize ?? 48,
                    fontFamily: captionStyle?.fontFamily ?? 'Inter',
                    fontWeight: 700,
                    color: isActive ? (captionStyle?.color ?? '#FFFFFF') : 'rgba(255,255,255,0.4)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  }}>
                    {word.text}
                  </span>
                );
              })}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

### Layout patterns:

**Stacked (video + visuals split):**
```tsx
<Sequence from={startFrame} durationInFrames={duration}>
  <div style={{ position: 'absolute', left: 0, top: 0, width, height: videoHeight, overflow: 'hidden' }}>
    <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
  <div style={{ position: 'absolute', top: videoHeight, width, height: visualsHeight, overflow: 'hidden' }}>
    <SegmentN width={width} height={visualsHeight} />
  </div>
</Sequence>
```

**Fullscreen (visuals only, audio from carrier):**
```tsx
<Sequence from={startFrame} durationInFrames={duration}>
  <SegmentN width={width} height={height} />
</Sequence>
```

**Overlay (visuals floating on video):**
```tsx
<Sequence from={startFrame} durationInFrames={duration}>
  <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
    <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
  <div style={{ position: 'absolute', left: x, top: y, width: overlayW, height: overlayH }}>
    <SegmentN width={overlayWPx} height={overlayHPx} />
  </div>
</Sequence>
```

### Adapting the example:
- Change segment imports, frame numbers, and layout dimensions to match your scenes.json
- The example shows 3 layout types — your composition may use any combination
- Split ratios, overlay positions, and segment count all come from scenes.json
- You may add transitions between segments (opacity fades, etc.) as Remotion code
```

- [ ] **Step 2: Update animator system.md**

In `packages/worker/src/prompts/animator/system.md`:

1. Change all references from `scenes/SceneN.tsx` to `segments/SegmentN.tsx`
2. Change "scene" terminology to "segment" where it refers to file output
3. Add `{{load: composition-assembly.md}}` reference
4. Update the mandatory process to include Composition.tsx generation as the final step
5. Update the file structure section to show `segments/` instead of `scenes/`

Key changes to the process:
- Phase 3 becomes: "For each segment, implement SegmentN.tsx"
- Add Phase 4: "Generate Composition.tsx following the example pattern"

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/animator/composition-assembly.md packages/worker/src/prompts/animator/system.md
git commit -m "feat(animator): add composition assembly prompt with example-based approach"
```

---

### Task 3: Delete composition/ template directory

**Files:**
- Delete: All files in `packages/worker/remotion-template/src/composition/`

- [ ] **Step 1: Delete all composition template files**

```bash
rm -rf packages/worker/remotion-template/src/composition/
```

These files are deleted because the AI now writes all composition code inline:
- `FullComposition.tsx` — replaced by AI-generated `Composition.tsx`
- `SpeakerVideo.tsx` — inline `<div>` + `<OffthreadVideo>`
- `PiPVideo.tsx` — inline positioning
- `SubtitleLayer.tsx` + `AnimatedSubtitle.tsx` — inline subtitle loop
- `VisualsLayer.tsx` — inline positioning
- `SceneTransitionLayer.tsx` — inline scene placement
- `utils.ts` — `resolveVideoSrc()` no longer needed
- `types.ts` — layout types deleted
- `index.ts` — barrel export deleted

- [ ] **Step 2: Update any imports that reference composition/**

Check for imports of `composition/` in the remotion-template outside of the deleted files. The `index.ts` entry point (`packages/worker/remotion-template/src/composition/index.ts`) was the barrel — verify no other files import from it.

Run: `grep -r "from.*composition" packages/worker/remotion-template/src/ --include="*.ts" --include="*.tsx"`

If any non-deleted files import from `composition/`, update or remove those imports.

- [ ] **Step 3: Commit**

```bash
git add -A packages/worker/remotion-template/src/composition/
git commit -m "refactor: delete composition/ template directory — AI generates inline"
```

---

## Chunk 2: Pipeline Changes

### Task 4: Update plan-visuals.ts for segments format

**Files:**
- Modify: `packages/worker/src/processors/plan-visuals.ts`

- [ ] **Step 1: Read the current plan-visuals.ts**

Read `packages/worker/src/processors/plan-visuals.ts` fully. Find where it parses the Director's output to extract `scenePlan` and `scenes` from the PLAN_READY JSON.

- [ ] **Step 2: Update PlanData interface**

Change the `PlanData` interface to support both v1 (legacy `scenes`) and v2 (`segments`):

```typescript
interface PlanData {
  scenePlan: string;
  scenes: Record<string, unknown>;  // Keep for backward compat
  segments?: any[];                  // v2 segments array
  version?: number;                  // 1 or 2
}
```

- [ ] **Step 3: Update PLAN_READY parsing**

Find the line that extracts `planData` from the Director output. Update to also capture the `segments` array and `version` field:

```typescript
// After parsing PLAN_READY JSON:
const planJson = JSON.parse(planReadyData);
const planData: PlanData = {
  scenePlan: planJson.scenePlan || '',
  scenes: planJson.scenes || planJson,
  segments: planJson.segments || undefined,
  version: planJson.version || 1,
};
```

- [ ] **Step 4: Update PlanVisualsJobData**

Remove `layoutMode` from `PlanVisualsJobData` — layout is now per-segment, not global:

```typescript
export interface PlanVisualsJobData {
  projectId: string;
  jobId: string;
  stylePreset: string;
  // layoutMode removed — layout is per-segment in v2
  dimensions: {
    width: number;
    height: number;
  };
  pipEffective?: {
    width: number;
    height: number;
  };
  styleGuide?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/plan-visuals.ts
git commit -m "feat(plan-visuals): support segments format from Director v2 output"
```

---

### Task 5: Update generate-visuals for segment-based timeline items

**Files:**
- Modify: `packages/worker/src/processors/generate-visuals/index.ts`
- Modify: `packages/worker/src/processors/generate-visuals/types.ts`

- [ ] **Step 1: Read generate-visuals/index.ts fully**

Read the entire file, paying attention to:
- How `metadata.visuals` is used (around line 585)
- The timeline item creation loop (lines 584-674)
- How `displayMode` and `pipEffective` dimensions are used
- The `layoutMode` persistence to `videoSettings`

- [ ] **Step 2: Update types.ts**

In `packages/worker/src/processors/generate-visuals/types.ts`, update `VisualMetadata`:

```typescript
// Add segment metadata type
export interface SegmentMetadata {
  id: number;
  layout: string;  // 'stacked' | 'fullscreen' | 'overlay'
  layoutProps: Record<string, unknown>;
  startMs: number;
  endMs: number;
  beatCount: number;
  description: string;
}

// In VisualMetadata, add:
export interface VisualMetadata {
  compositionId: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  visuals: Array<{
    id: number;
    startMs: number;
    endMs: number;
    description: string;
    type?: string;
    displayMode?: string;
    transition?: any;
  }>;
  // New: v2 segment metadata
  segments?: SegmentMetadata[];
  version?: number;
}
```

Also remove `layoutMode` from `GenerateVisualsJobData` (replace with optional, for backward compat):

```typescript
export interface GenerateVisualsJobData {
  // ... existing fields
  layoutMode?: 'pip' | 'stacked';  // Legacy — ignored in v2
  // ... rest
}
```

- [ ] **Step 3: Update timeline item creation for segments**

In `packages/worker/src/processors/generate-visuals/index.ts`, find the timeline item creation loop (around line 584). Add a branch for v2 segment-based items:

```typescript
// After reading metadata from Python output...
if (metadata.version === 2 && metadata.segments) {
  // V2: One timeline item per segment
  for (const segment of metadata.segments) {
    const segmentW = segment.layout === 'stacked'
      ? canvasWidth
      : canvasWidth;
    const segmentH = segment.layout === 'stacked'
      ? canvasHeight
      : canvasHeight;

    await tx.insert(timelineItems).values({
      trackId: visualsTrack.id,
      type: 'visual',
      startMs: segment.startMs,
      endMs: segment.endMs,
      data: {
        visualId,
        compositionId: metadata.compositionId,
        bundleUrl,
        description: segment.description,
        width: canvasWidth,
        height: canvasHeight,
        fps: metadata.fps,
        segmentId: segment.id,
        layout: segment.layout,
        beatCount: segment.beatCount,
      },
    });
  }
} else {
  // V1: Legacy per-scene items (existing code)
  for (let sceneIndex = 0; sceneIndex < metadata.visuals.length; sceneIndex++) {
    // ... existing code unchanged
  }
}
```

- [ ] **Step 4: Remove layoutMode persistence to videoSettings**

Find the section (around line 690) that persists `layoutMode` into `project.videoSettings.layoutSettings`. Remove or skip this in v2:

```typescript
// Only persist layout mode for legacy v1
if (!metadata.version || metadata.version < 2) {
  await tx.update(projects)
    .set({
      // ... existing layoutSettings persistence
    })
    .where(eq(projects.id, projectId));
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/generate-visuals/index.ts packages/worker/src/processors/generate-visuals/types.ts
git commit -m "feat(generate-visuals): create segment-based timeline items for v2"
```

---

### Task 6: Update Python pipeline for segments directory structure

**Files:**
- Modify: `packages/worker/src/agents/visual_generator/_pipeline.py`
- Modify: `packages/worker/src/agents/visual_generator/_validators.py`

- [ ] **Step 1: Read _pipeline.py fully**

Read the full file to understand the checkpoint resume logic, the animator invocation, and the file structure expectations.

- [ ] **Step 2: Update _pipeline.py checkpoint detection**

The checkpoint resume logic checks for `index.tsx`, `metadata.json`, `scenes.json`. Update to also check for `Composition.tsx` and `segments/` directory:

```python
# In the resume logic section:
has_composition = os.path.exists(os.path.join(project_dir, 'Composition.tsx'))
has_segments_dir = os.path.isdir(os.path.join(project_dir, 'segments'))

# V2 checkpoint: if Composition.tsx + segments/ exist, skip to verification
if has_composition and has_segments_dir and scenes_json_exists:
    # Skip to TypeScript verification + bundle
    ...
```

- [ ] **Step 3: Update _validators.py for segments format**

In `_validators.py`, the `_validate_scene_plan()` function validates the flat `scenes[]` array. Add v2 validation:

```python
def _validate_scene_plan(self, scenes_json: dict) -> None:
    version = scenes_json.get('version', 1)

    if version >= 2:
        self._validate_segments(scenes_json)
        return

    # ... existing v1 validation unchanged

def _validate_segments(self, scenes_json: dict) -> None:
    """Validate v2 segments format."""
    segments = scenes_json.get('segments', [])
    if not segments:
        raise ValueError("scenes.json v2 has no segments")

    fps = scenes_json.get('fps', 30)

    for seg in segments:
        if 'id' not in seg or 'layout' not in seg or 'frames' not in seg:
            raise ValueError(f"Segment {seg.get('id', '?')} missing required fields")

        if seg['layout'] not in ('stacked', 'fullscreen', 'overlay'):
            raise ValueError(f"Segment {seg['id']} has invalid layout: {seg['layout']}")

        if not seg.get('beats'):
            raise ValueError(f"Segment {seg['id']} has no beats")

        start, end = seg['frames']
        duration = end - start
        if duration < 60:  # ~2 seconds minimum
            raise ValueError(f"Segment {seg['id']} too short: {duration} frames")
```

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/agents/visual_generator/_pipeline.py packages/worker/src/agents/visual_generator/_validators.py
git commit -m "feat(pipeline): update Python pipeline for v2 segments format"
```

---

### Task 7: Rewrite workspace-codegen.ts as thin wrapper

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts`

- [ ] **Step 1: Read workspace-codegen.ts fully**

Read the entire file (already partially read). Understand `discoverScenes()`, `generatePlayerComposition()`, and `updateRootWithPlayerComposition()`.

- [ ] **Step 2: Rewrite generatePlayerComposition()**

Replace the current `generatePlayerComposition` function with a thin wrapper that detects v2 (has `Composition.tsx`) vs v1 (legacy scenes):

```typescript
export async function generatePlayerComposition(projectId: string): Promise<void> {
  const srcPath = getWorkspaceSrcPath(projectId);
  const compositionDir = join(srcPath, `proj_${projectId.replace(/-/g, '_')}`);

  // Check if AI-generated Composition.tsx exists (v2)
  let hasCompositionTsx = false;
  try {
    await readFile(join(compositionDir, 'Composition.tsx'));
    hasCompositionTsx = true;
  } catch {
    // No Composition.tsx — fall back to legacy codegen
  }

  if (hasCompositionTsx) {
    await generateV2PlayerComposition(projectId, srcPath);
  } else {
    await generateV1PlayerComposition(projectId, srcPath);
  }
}

/**
 * V2: Thin wrapper that imports the AI-generated Composition.
 */
async function generateV2PlayerComposition(projectId: string, srcPath: string): Promise<void> {
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  const code = `import React from 'react';
import { Composition } from './${compositionId}/Composition';

class CompositionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#f44', fontFamily: 'monospace', fontSize: 14, padding: 20, textAlign: 'center' }}>
            Composition error: {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const PlayerComposition: React.FC<{
  manifest: any;
  videoUrl?: string;
  audioUrl?: string;
}> = ({ manifest, videoUrl, audioUrl }) => {
  const subtitles = (manifest?.items || [])
    .filter((it: any) => it.type === 'caption')
    .map((it: any) => ({
      startMs: it.startMs,
      endMs: it.endMs,
      words: (it.data?.words || []).map((w: any) => ({
        text: w.text,
        startMs: w.startMs + it.startMs,
        endMs: w.endMs + it.startMs,
      })),
    }));

  return (
    <CompositionErrorBoundary>
      <Composition
        videoUrl={videoUrl || ''}
        subtitles={subtitles}
        captionStyle={manifest?.captionStyle}
      />
    </CompositionErrorBoundary>
  );
};
`;

  await writeFile(join(srcPath, 'PlayerComposition.tsx'), code, 'utf-8');
}
```

- [ ] **Step 3: Keep legacy generateV1PlayerComposition**

Rename the existing `generatePlayerComposition` internals to `generateV1PlayerComposition` — this is the compatibility shim for old projects that still have `scenes/SceneN.tsx` without `Composition.tsx`. Keep all existing code (discoverScenes, buildLayoutSegments, etc.) inside this function.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat(codegen): thin wrapper for v2 AI-generated Composition, legacy shim for v1"
```

---

## Chunk 3: Edit-Visuals + Agent Tools + Frontend

### Task 8: Expand edit-visuals scope for Composition.tsx + segments/

**Files:**
- Modify: `packages/worker/src/processors/edit-visuals/editor.ts`
- Modify: `packages/worker/src/processors/edit-visuals/context.ts`

- [ ] **Step 1: Read editor.ts and context.ts fully**

Read both files to understand the current scope restriction logic and context building.

- [ ] **Step 2: Update editor.ts scope restriction**

In `editor.ts`, find the `SCOPE RESTRICTION` section of the edit prompt (around line 168). Add v2 scope logic:

```typescript
// Detect v2 project by checking for Composition.tsx
let isV2 = false;
try {
  await readFile(join(projectDir, 'Composition.tsx'));
  isV2 = true;
} catch { /* v1 */ }

// Build scope restriction based on version
let scopeRestriction = '';
if (isV2) {
  if (allTargetIds.length > 0) {
    const segmentFiles = allTargetIds.map(id => `segments/Segment${id}.tsx`).join(', ');
    scopeRestriction = `
SCOPE RESTRICTION (MANDATORY):
- For ANIMATION/VISUAL changes: edit ${segmentFiles} and their dependencies (components/ or constants.ts).
- For LAYOUT/POSITIONING changes (split ratio, overlay position): edit Composition.tsx.
- If the request involves both, you may edit both Composition.tsx and the segment files.
- Do NOT touch other segment files that aren't listed above.
`;
  }
} else {
  // Existing v1 scope restriction (unchanged)
  if (allTargetIds.length > 0) {
    scopeRestriction = `
SCOPE RESTRICTION (MANDATORY):
- You MUST ONLY edit ${allTargetIds.map(id => `scenes/Scene${id}.tsx`).join(', ')} and their direct dependencies.
// ... existing v1 scope restriction
`;
  }
}
```

- [ ] **Step 3: Update context.ts for v2 layout context**

In `context.ts`, the `buildLayoutContext()` function reads scenes.json for layout info. Update to handle v2 segments:

```typescript
export async function buildLayoutContext(
  projectDir: string,
  targetSceneId: number | undefined,
  canvasWidth: number,
  canvasHeight: number,
): Promise<string> {
  try {
    const raw = await readFile(join(projectDir, 'scenes.json'), 'utf-8');
    const parsed = JSON.parse(raw);

    if (parsed.version >= 2 && parsed.segments) {
      return buildV2LayoutContext(parsed, targetSceneId, canvasWidth, canvasHeight);
    }

    // Existing v1 logic...
  } catch {
    return '';
  }
}

function buildV2LayoutContext(
  scenesJson: any,
  targetSegmentId: number | undefined,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const segments = scenesJson.segments || [];
  const lines = ['COMPOSITION LAYOUT (v2 — segments):'];

  for (const seg of segments) {
    const [startF, endF] = seg.frames;
    const dur = endF - startF;
    const marker = targetSegmentId === seg.id ? ' ← TARGET' : '';
    lines.push(`  Segment ${seg.id}: ${seg.layout} | frames ${startF}–${endF} (${dur}f) | ${seg.beats?.length || 0} beats${marker}`);
    if (seg.layoutProps && Object.keys(seg.layoutProps).length > 0) {
      lines.push(`    Props: ${JSON.stringify(seg.layoutProps)}`);
    }
  }

  lines.push(`  Canvas: ${canvasWidth}×${canvasHeight}`);
  lines.push('  Note: Composition.tsx controls layout. Segment files control animation content.');

  return lines.join('\n');
}
```

- [ ] **Step 4: Update scene file references for v2**

In `editor.ts`, find where it references `scenes/Scene${id}.tsx`. For v2, these become `segments/Segment${id}.tsx`:

```typescript
// In the targetSceneContext building section:
if (isV2) {
  for (const id of allTargetIds) {
    const segment = segments.find((s: any) => s.id === id);
    if (segment) {
      parts.push(`- Segment ${segment.id}: "${segment.beats?.map((b: any) => b.name).join(' → ')}" · File: segments/Segment${segment.id}.tsx · Layout: ${segment.layout} · Frames: ${segment.frames[0]}–${segment.frames[1]}`);
    }
  }
} else {
  // Existing v1 scene context
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/edit-visuals/editor.ts packages/worker/src/processors/edit-visuals/context.ts
git commit -m "feat(edit-visuals): expand scope for v2 Composition.tsx + segments/"
```

---

### Task 9: Remove set_layout and set_display_mode agent tools

**Files:**
- Modify: `packages/api/src/agent/agent-tools.ts`

- [ ] **Step 1: Read agent-tools.ts fully**

Read the entire file to find `set_layout` and `set_display_mode` tool definitions.

- [ ] **Step 2: Remove tool definitions**

Find and remove the `tool()` definitions for `set_layout` and `set_display_mode`. These are MCP tools registered on the `creative-director` server.

- [ ] **Step 3: Update TOOL_NAMES array**

Remove from the `TOOL_NAMES` export:
```typescript
// Remove these lines:
`mcp__${MCP_SERVER_NAME}__set_layout`,
`mcp__${MCP_SERVER_NAME}__set_display_mode`,
```

- [ ] **Step 4: Also remove set_transition**

Per the spec, `set_transition` is also no longer needed (transitions are in AI code):
```typescript
// Remove:
`mcp__${MCP_SERVER_NAME}__set_transition`,
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/agent/agent-tools.ts
git commit -m "refactor(agent): remove set_layout, set_display_mode, set_transition tools"
```

---

### Task 10: Simplify frontend types and remove layout settings

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/types.ts`
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts`

- [ ] **Step 1: Read types.ts and editor-store.ts**

Read both files. Find:
- `LayoutSettings` interface and its uses
- `layoutPresetId` in state
- `setLayoutMode`, `setLayoutPreset`, `updateLayoutSettings` actions
- `VisualItemData` type with `displayMode`, `effectiveWidth/Height`, `transition`, etc.

- [ ] **Step 2: Add v2 VisualItemData fields to types.ts**

Add segment-based fields alongside existing ones (don't remove v1 fields yet — they're needed for backward compat):

```typescript
// Add to VisualItemData:
export interface VisualItemData {
  // ... existing v1 fields kept for backward compat

  // V2 segment fields
  segmentId?: number;
  layout?: string;      // 'stacked' | 'fullscreen' | 'overlay' — for timeline UI
  beatCount?: number;
}
```

- [ ] **Step 3: Remove layout settings from editor-store.ts**

In `editor-store.ts`, find the initial state and remove:
- `layoutSettings` from state
- `layoutPresetId` from state

Find and remove these actions:
- `setLayoutMode`
- `setLayoutPreset`
- `updateLayoutSettings`
- `updateVisualDisplayMode` (displayMode is now in AI code)
- `updateVisualTransition` (transitions are in AI code)

Keep all other actions (timeline manipulation, caption style, playback, etc.).

- [ ] **Step 4: Update any components that reference removed state**

Search for uses of removed state/actions:
```bash
grep -r "layoutSettings\|layoutPresetId\|setLayoutMode\|setLayoutPreset\|updateLayoutSettings\|updateVisualDisplayMode\|updateVisualTransition" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

For each file found, remove the dead references. If a component's sole purpose was layout mode switching (e.g., a layout picker), comment it out or remove it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/store/types.ts apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "refactor(frontend): remove layout settings, add v2 segment fields to VisualItemData"
```

---

### Task 11: Update shared types

**Files:**
- Modify: `packages/shared/src/types/index.ts` (if it contains `VisualDisplayMode`, `LayoutTransition`, etc.)

- [ ] **Step 1: Read shared types**

Read `packages/shared/src/types/index.ts` to find layout-related types.

- [ ] **Step 2: Keep types but mark deprecated**

Don't delete shared types that may be referenced by existing v1 code paths. Instead, add a comment:

```typescript
/** @deprecated v1 only — v2 uses segment-level layout in AI code */
export type VisualDisplayMode = 'default' | 'fullscreen' | 'overlay';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "refactor(shared): deprecate v1 layout types"
```

---

### Task 12: Update agent system prompt for expanded edit_visuals scope

**Files:**
- Modify: `packages/api/src/agent/agent-system-prompt.ts`

- [ ] **Step 1: Read agent-system-prompt.ts**

Read the file to find where it describes available tools to the AI assistant.

- [ ] **Step 2: Update tool descriptions**

Remove descriptions for `set_layout`, `set_display_mode`, `set_transition`. Update the `edit_visuals` description to mention it handles layout changes too:

```
- edit_visuals: Edit visual animations OR layout. For animation changes (colors, motion, text), targets segment files. For layout changes (split ratio, overlay position), targets Composition.tsx. Specify which segment(s) to edit.
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/agent/agent-system-prompt.ts
git commit -m "refactor(agent): update system prompt for v2 — edit_visuals handles layout"
```
