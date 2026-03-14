# AI-Driven Composition Generation

## Problem

The current architecture separates content creation (AI generates scene files) from composition assembly (hardcoded `FullComposition` template with layout modes). The AI has zero control over how scenes are composed onto video. Layout is constrained to predefined modes (stacked/pip) with global settings. Per-scene layout data from the Director (overlay positions, split ratios) is ignored by the composition renderer.

This means prompts like "make it 70/30 split", "put the overlay bottom-left at 40% size", or "make the animation fullscreen for the reveal" require specialized tools and hardcoded layout infrastructure, instead of leveraging the fact that everything is Remotion code that the AI already writes.

## Solution

Let the AI generate the entire composition — scenes AND the assembly code that stitches them onto video. Instead of importing pre-built template components, the Animator sees a complete example composition and writes everything inline. The components involved (video rendering, subtitle display) are too small to warrant abstraction. Every aspect of the video output is controllable through prompts because the AI writes the code.

## Reference

- Product reference: [Cardboard](https://www.usecardboard.com/) — real editing, not preset-based
- The AI writes Remotion React code — everything is controllable through code

---

## Design

### 1. Director Changes — Beat Grouping into Segments

**Current:** Director outputs one scene per narrative beat, each with `displayMode`. All become separate files.

**New:** Director plans per-beat as before, but adds a grouping step. Consecutive beats sharing the same layout become a **segment**. One animation file per segment — motion flows continuously within a segment.

**Output format (`scenes.json`):**

```json
{
  "version": 2,
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
    },
    {
      "id": 2,
      "layout": "fullscreen",
      "layoutProps": {},
      "frames": [720, 1080],
      "beats": [
        { "id": 3, "name": "Big Reveal", "frames": [720, 1080], "visual": "..." }
      ]
    },
    {
      "id": 3,
      "layout": "overlay",
      "layoutProps": { "x": "10%", "y": "60%", "width": "40%", "height": "35%" },
      "frames": [1080, 1500],
      "beats": [
        { "id": 4, "name": "Details", "frames": [1080, 1290], "visual": "..." },
        { "id": 5, "name": "Takeaway", "frames": [1290, 1500], "visual": "..." }
      ]
    }
  ]
}
```

**Key rules:**
- Consecutive beats with same `layout` type are grouped into one segment
- Layout change = new segment = new animation file
- Beats within a segment are narrative markers for the Animator — continuous motion, not hard cuts
- `layoutProps` varies by layout type — stacked has `splitRatio`, overlay has position/size, fullscreen has nothing
- A brief layout change (e.g., fullscreen reveal) between two stacked sections produces 3 segments — this is intentional (continuous motion within each, clean transition between)

**`layoutProps` schema per layout type:**

```typescript
// Stacked: video + visuals split vertically
interface StackedLayoutProps {
  splitRatio: number;        // 0-100, percentage of canvas for video (e.g., 70 = video 70%, visuals 30%)
  position: 'video-first' | 'visuals-first';  // which is on top
}

// Overlay: visuals floating on top of full video
interface OverlayLayoutProps {
  x: string;      // CSS percentage, e.g., "10%"
  y: string;      // CSS percentage, e.g., "60%"
  width: string;  // CSS percentage, e.g., "40%"
  height: string; // CSS percentage, e.g., "35%"
}

// Fullscreen: visuals fill entire canvas, audio only (no video)
interface FullscreenLayoutProps {}  // no props needed
```

**Schema versioning:** `scenes.json` gains a `"version": 2` field. All consumers check version to distinguish from the legacy flat `scenes[]` format (version 1 / no version field).

### 2. Animator Changes — Continuous Animations + Composition Assembly

**Current:** Animator generates `scenes/Scene1.tsx`, `Scene2.tsx` (one per beat) + `index.tsx` that imports/exports them. No awareness of layout or video.

**New:** Animator generates three things:

#### a) One animation file per segment

```
segments/
  Segment1.tsx   (beats 1-2, stacked, continuous motion)
  Segment2.tsx   (beat 3, fullscreen)
  Segment3.tsx   (beats 4-5, overlay, continuous motion)
```

Each segment component receives `width` and `height` props matching its container dimensions and renders a continuous animation spanning all its beats. The Animator knows beat boundaries (for sync points) but treats them as moments in a continuous flow.

**Segment component contract:**
```tsx
interface SegmentProps {
  width: number;   // container width in pixels
  height: number;  // container height in pixels
}

// Example: Segment1 rendered in stacked 70/30 layout (bottom 30%)
// Receives width=1080, height=576 (1920 * 0.3)
export const Segment1: React.FC<SegmentProps> = ({ width, height }) => {
  const frame = useCurrentFrame(); // 0-relative within this segment's Sequence
  // ... animation using width/height for layout, frame for timing
};
```

**Critical frame timing rule:** Inside a `<Sequence>`, `useCurrentFrame()` returns 0-relative frames (NOT absolute). Segment animations MUST use relative frame numbers (0 to segment duration). Beat frame offsets within a segment are relative to segment start. This is a known bug source — the Animator prompt must enforce this explicitly.

#### b) The composition assembly (`Composition.tsx`)

The Animator writes this from scratch, guided by an **example composition** in the prompt. No template imports — everything is inline Remotion code. The components involved (a div with an OffthreadVideo, a subtitle word loop) are too small to justify abstraction.

**Example composition (included in Animator prompt):**

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
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
      {/* CRITICAL: Persistent audio carrier — always rendered outside Sequences
          so audio never drops during segment transitions. */}
      <OffthreadVideo
        src={videoUrl}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />

      {/* Segment 1: stacked 70/30 — video top, visuals bottom */}
      <Sequence from={0} durationInFrames={720}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height: videoH70, overflow: 'hidden' }}>
          <OffthreadVideo
            src={videoUrl}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ position: 'absolute', top: videoH70, width, height: visualsH30, overflow: 'hidden' }}>
          <Segment1 width={width} height={visualsH30} />
        </div>
      </Sequence>

      {/* Segment 2: fullscreen visuals, audio only (video hidden, audio from carrier) */}
      <Sequence from={720} durationInFrames={360}>
        <Segment2 width={width} height={height} />
      </Sequence>

      {/* Segment 3: overlay visuals on full video */}
      <Sequence from={1080} durationInFrames={420}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
          <OffthreadVideo
            src={videoUrl}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ position: 'absolute', left: '10%', top: '60%', width: '40%', height: '35%' }}>
          <Segment3 width={Math.round(width * 0.4)} height={Math.round(height * 0.35)} />
        </div>
      </Sequence>

      {/* Subtitles — rendered at root level with absolute timestamps */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 40px 80px' }}>
        {subtitles.map((subtitle, i) => {
          if (currentTimeMs < subtitle.startMs || currentTimeMs > subtitle.endMs) return null;
          return (
            <div key={i} style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 8px',
            }}>
              {subtitle.words.map((word, j) => {
                const isActive = currentTimeMs >= word.startMs;
                return (
                  <span key={j} style={{
                    fontSize: captionStyle?.fontSize ?? 48,
                    fontFamily: captionStyle?.fontFamily ?? 'Inter',
                    fontWeight: 700,
                    color: isActive ? (captionStyle?.color ?? '#FFFFFF') : 'rgba(255,255,255,0.4)',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    transition: 'color 0.1s',
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

The AI writes its own composition following this example's patterns. It can vary anything — split ratios, overlay positions, transitions, video crop, subtitle styling — all expressed as inline Remotion code.

**Key patterns the AI must follow (enforced in prompt):**

1. **Audio carrier:** Persistent hidden `<OffthreadVideo>` (1x1, opacity 0) outside all `<Sequence>` blocks. Without this, audio glitches at segment boundaries.
2. **Muted per-segment video:** All visible `<OffthreadVideo>` elements inside Sequences use `muted` — audio comes only from the carrier.
3. **Root-level subtitles:** Subtitle rendering at root level using absolute `currentTimeMs`, not inside Sequences (avoids 0-relative frame offset bugs).
4. **Segment props:** Pass `width` and `height` to segment components matching their container dimensions.

#### c) What gets deleted from `composition/`

The entire `composition/` directory of pre-built components is removed. The AI writes everything inline.

**Deleted:**
- `FullComposition.tsx` — replaced by AI-generated `Composition.tsx`
- `SpeakerVideo.tsx` — a div + OffthreadVideo, written inline
- `SubtitleLayer.tsx` + `AnimatedSubtitle.tsx` — subtitle loop written inline
- `SceneTransitionLayer.tsx` — AI handles scene placement directly
- `VisualsLayer.tsx` — AI handles positioning directly
- `PiPVideo.tsx` — AI writes PiP positioning in code
- `utils.ts` — `resolveVideoSrc()` becomes unnecessary (AI uses `videoUrl` prop directly)
- `types.ts` — layout types no longer needed
- Layout computation: `computeLayoutForFrame()`, `getRectsForMode()`, `computePiPLayoutForFrame()`
- Layout types: `LayoutMode`, `LayoutSegment`, `SplitSettings`, `PiPSettings`, `DisplayMode`

**Kept:** Nothing. The `composition/` directory is fully replaced by AI-generated code per project.

### 3. Codegen Changes — Thin Wrapper

**Current:** `workspace-codegen.ts` generates `PlayerComposition.tsx` with ~150 lines of layout conversion logic (`buildLayoutSegments`, `buildSceneItems`, `buildSubtitles`, scene discovery, layout mode handling).

**New:** Codegen generates a thin wrapper that imports the AI-generated composition:

```tsx
import React from 'react';
import { Composition } from './{compositionId}/Composition';

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
    <Composition
      videoUrl={videoUrl}
      audioUrl={audioUrl}
      subtitles={subtitles}
      captionStyle={manifest?.captionStyle}
    />
  );
};
```

**Deleted from codegen:**
- `buildLayoutSegments()`
- `buildSceneItems()`
- `discoverScenes()`
- Layout/scene conversion logic
- Scene map generation

**No changes to:**
- `bundler-service.ts` — same esbuild CJS pipeline
- `useWorkspaceComposition.ts` — same custom require shim + Player
- `WorkspacePlayer.tsx` — same Player wrapper

### 4. Manifest & Timeline Item Changes

**Manifest simplification — removed fields:**
- `layout: { mode, split, pip }` — AI's composition code handles layout
- Per-item `displayMode`, `transition`, `sceneFile`, `frameOffset` — baked into AI code

**Manifest keeps:**
- `items` — timing and track info (for timeline UI rendering)
- `videoSettings` — source video dimensions, crop defaults
- `captionStyle` — default caption styling
- `canvas`, `fps`, `durationMs`

**Timeline items:** One visual item per segment (not per beat).

```
Timeline:
  Video track:   [===========video===========]
  Audio track:   [===========audio===========]
  Visual track:  [Seg1 stacked][Seg2 full][Seg3 overlay]
  Caption track: [caption][caption][caption][caption]
```

**VisualItemData simplified:**
```typescript
export interface VisualItemData {
  visualId: string;
  compositionId: string;
  bundleUrl: string;
  segmentId: number;
  description: string;
  layout: string;           // 'stacked' | 'fullscreen' | 'overlay' — for timeline UI color coding only
  beatCount: number;
  width: number;
  height: number;
  fps: number;
}
```

The `layout` field is purely for timeline display — it has no effect on rendering.

### 5. Frontend Store Changes

**Removed:**
- `layoutSettings`, `layoutPresetId` from editor state
- `updateLayoutSettings`, `setLayoutPreset`, `setLayoutMode` actions
- Layout presets and preset picker
- `PiPControlPanel` as a layout mode switcher (could be repurposed as AI prompt shortcut)

**Kept:**
- All timeline manipulation (move, resize, delete items)
- Caption style editing
- Video crop settings (global defaults the AI can override per-segment)
- Playback controls, selection, undo/redo

### 6. AI Agent Tool Changes

**Removed:**
- `set_layout` — AI edits composition code instead
- `set_display_mode` — baked into composition code

**Kept:**
- `move_item`, `delete_item`, `split_scene`, `reorder_scenes` — timeline timing manipulation
- `edit_visuals` — becomes the primary tool for ALL visual changes including layout
- `plan_visuals`, `start_generation`, `update_plan` — planning flow unchanged
- `read_manifest`, `update_caption_style` — still useful

**`edit_visuals` scope expands:** "Make it 70/30" triggers an edit to `Composition.tsx`, not a tool call to `set_layout`. The AI edits the code that controls layout.

### 7. Prompt Changes

**Director prompt:**
- Add segment grouping rules: "Group consecutive beats with same layout into segments"
- Output `segments` array instead of flat `scenes` array
- Each segment has `layout`, `layoutProps`, and nested `beats`

**Animator prompt:**
- Generate `segments/SegmentN.tsx` instead of `scenes/SceneN.tsx`
- Generate `Composition.tsx` following the example composition pattern (included in prompt)
- Everything inline — no template imports, just Remotion primitives
- Must follow the 4 key patterns: audio carrier, muted per-segment video, root-level subtitles, segment dimension props

**Editor prompt (edit-visuals):**
- Expanded scope: can edit `Composition.tsx` in addition to segment files
- Layout change requests route to composition code edits

### 8. Generation Pipeline Changes

**`plan-visuals.ts`:**
- Parse `segments` from Director output instead of flat `scenes`
- Pass segment info to generation phase

**`generate-visuals/index.ts`:**
- Create one timeline item per segment (not per beat)
- Write segment metadata to `visuals` table
- No longer set per-item `displayMode` or `transition` — these are in AI code

**`edit-visuals/editor.ts`:**
- Expand scope restriction: AI can edit `Composition.tsx` + `segments/SegmentN.tsx`
- Layout edit requests target `Composition.tsx`
- **File targeting logic:** The edit-visuals processor inspects the user's request:
  - Layout/positioning changes (split ratio, overlay position, segment order) → scope to `Composition.tsx`
  - Animation/visual changes (colors, motion, text) → scope to the relevant `segments/SegmentN.tsx`
  - Both → scope to both files
- System prompt for the Claude subprocess includes: file list, current `Composition.tsx` content, example composition patterns
- All edits (composition or segment) trigger a full rebundle — no incremental bundling

### 9. Error Handling for AI-Generated Composition

**Compilation check:** After the Animator generates `Composition.tsx`, run `tsc --noEmit` (already in the pipeline). If it fails, the Animator retries with the error output.

**Runtime error boundary:** The codegen thin wrapper wraps the AI-generated `<Composition>` in a React error boundary. If the composition throws at render time, the error boundary shows a fallback (black screen + error text in dev, just black in production). This prevents the entire Player from crashing.

**Fallback for broken compositions:** If `Composition.tsx` exists but fails to compile after retries, the pipeline marks the visual as failed and reports the error to the user via the AI assistant. The user can request regeneration.

---

## Migration Path

This is a breaking change to the visual generation pipeline. Existing projects with visuals generated under the old system (scenes/SceneN.tsx + FullComposition) will need either:

1. **Regeneration** — user regenerates visuals, which produces new segment-based output
2. **Compatibility shim** — if old-style scenes exist and no `Composition.tsx` is found, codegen falls back to the current `FullComposition` behavior

Option 2 is recommended for a smooth transition.

## Future Enhancements (Out of Scope)

- **Expanded timeline view** — collapse/expand visual segments to see element-level timing (AI outputs `timeline.json` metadata)
- **Overlay draggability** — drag overlay visuals on the preview canvas, AI updates `Composition.tsx` position values
- **Video editing primitives** — cut/split/trim video track through AI conversation
- **Per-section video crop** — AI writes different crop settings per segment in `Composition.tsx`
