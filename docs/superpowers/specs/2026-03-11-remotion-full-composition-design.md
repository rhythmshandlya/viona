# Remotion Full Composition — Design Spec

## Problem

Display mode transitions (stacked ↔ fullscreen ↔ overlay) produce jarring hard cuts or simple alpha fades. Elements don't physically move between layouts, breaking visual continuity. The root cause: FFmpeg filter chains handle layout composition, making animated spatial transitions extremely difficult.

## Solution

Move **all visual composition** into a single Remotion React composition. Speaker video, generated visuals, subtitles, and layout transitions all render in React. FFmpeg reduces to a final encoder/audio muxer.

```
Before: Remotion (visuals only) → FFmpeg (composites video + visuals + subtitles)
After:  Remotion (everything)   → FFmpeg (encodes + muxes audio)
```

## Architecture

### New Remotion Composition Tree

```
<FullComposition>                     ← Root, receives all props
  <AbsoluteFill>
    <LayoutManager                    ← Calculates animated rects per frame
      segments={displayModeSegments}
      layoutSettings={layoutSettings}
      transitionFrames={12}           ← Fixed 400ms @ 30fps
    >
      {(videoRect, visualsRect, overlayOpacity) => (
        <>
          <VisualsLayer               ← Existing scene compositions
            rect={visualsRect}
            scenes={scenes}
          />
          <SpeakerVideo               ← <OffthreadVideo> with crop
            rect={videoRect}
            src={staticFile('source.mp4')}
            crop={videoCropSettings}
          />
          <VideoClipLayer             ← YouTube clip overlays per scene
            clips={videoClips}
            scenes={scenes}
          />
          <SubtitleLayer              ← React-rendered captions
            subtitles={subtitleData}
            videoRect={videoRect}
            captionStyle={captionStyle}
            captionPosition={captionPosition}
          />
        </>
      )}
    </LayoutManager>
  </AbsoluteFill>
</FullComposition>
```

### Component Responsibilities

#### LayoutManager

Core orchestrator. For each frame, computes interpolated rectangles for video and visuals layers.

**Note on types:** The existing codebase has a `DisplayModeSegment` type (in `render/types.ts`) that uses `startMs`/`endMs` and has no `displayMode` field — segments are split into separate typed arrays (`fullscreenVisualSegments`, `overlaySegments`, `gapSegments`). This design replaces that pattern with a **new** unified `LayoutSegment` type that uses frame numbers and carries the display mode inline. The worker pipeline converts from the existing ms-based visual timeline items to this frame-based format before passing as props.

**Note on `'pip'` vs `'default'`:** The editor uses `VisualDisplayMode = 'default' | 'fullscreen' | 'overlay'`. Some render pipeline paths use `'pip'` as a fallback. A `normalizeDisplayMode()` function already exists to map `'pip'` → `'default'`. All display mode values MUST be normalized before reaching LayoutManager.

**Inputs:**
- `segments: LayoutSegment[]` — unified timeline of display modes with frame ranges (new type, replaces three separate segment arrays)
- `layoutSettings: LayoutSettings` — stacked ratio, position, gap
- `transitionFrames: 12` — fixed transition duration (400ms @ 30fps). This is a deliberate simplification — the existing per-segment `enterDurationMs`/`exitDurationMs` is dropped in favor of a consistent 12-frame window.

**Per-frame logic:**
1. Find current segment (binary search on frame)
2. Check if frame is within transition window (last 12 frames of prev segment / first 12 frames of current segment)
3. If in transition: interpolate between source and target rects
4. If not: return static rects for current display mode

**Rect calculation per display mode** (uses `useVideoConfig()` for width/height — examples below use 1080×1920, stacked 50/50 visuals-first):

| Display Mode | Video Rect | Visuals Rect | Overlay Opacity |
|---|---|---|---|
| `default` (stacked, visuals-first) | `{x:0, y:960, w:1080, h:960}` | `{x:0, y:0, w:1080, h:960}` | 1.0 |
| `default` (stacked, video-first) | `{x:0, y:0, w:1080, h:960}` | `{x:0, y:960, w:1080, h:960}` | 1.0 |
| `fullscreen` | `{x:0, y:1920, w:1080, h:0}` (off-canvas) | `{x:0, y:0, w:1080, h:1920}` | 1.0 |
| `overlay` | `{x:0, y:0, w:1080, h:1920}` | `{x:0, y:0, w:1080, h:1920}` | 0.85 |

**Transition interpolation** uses `interpolate()` with clamp:
```tsx
const x = interpolate(frame, [transStart, transEnd], [srcRect.x, dstRect.x], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
// Same for y, w, h, opacity
```

Easing: linear interpolation (smooth slide/resize as specified).

#### SpeakerVideo

Renders the speaker's video using `<OffthreadVideo>`.

```tsx
const SpeakerVideo: React.FC<{
  rect: Rect;
  src: string;
  crop: VideoCropSettings;
}> = ({ rect, src, crop }) => {
  // Skip rendering when off-canvas (fullscreen mode)
  if (rect.h <= 0) return null;

  return (
    <div style={{
      position: 'absolute',
      left: rect.x, top: rect.y,
      width: rect.w, height: rect.h,
      overflow: 'hidden',
    }}>
      <OffthreadVideo
        src={src}
        style={{
          width: scaledWidth,   // Derived from crop.scale
          height: scaledHeight,
          objectFit: 'cover',
          transform: `translate(${cropOffsetX}px, ${cropOffsetY}px)`,
        }}
      />
    </div>
  );
};
```

**Crop mapping:** `VideoCropSettings` (cropX/cropY as 0-100%, scale as multiplier) translates to CSS transform offsets within the clipped container.

#### VisualsLayer

Wrapper around existing scene compositions. Clips and positions them within the calculated rect.

```tsx
const VisualsLayer: React.FC<{
  rect: Rect;
  overlayOpacity: number;
}> = ({ rect, overlayOpacity, children }) => {
  if (rect.h <= 0) return null;
  const { width, height } = useVideoConfig(); // Not hardcoded 1080x1920

  return (
    <div style={{
      position: 'absolute',
      left: rect.x, top: rect.y,
      width: rect.w, height: rect.h,
      overflow: 'hidden',
      opacity: overlayOpacity,
    }}>
      <div style={{
        transform: `scale(${rect.w / width}, ${rect.h / height})`,
        transformOrigin: 'top left',
        width, height,
      }}>
        {/* Existing <Sequence> tree with Scene1, Scene2, etc. */}
        {children}
      </div>
    </div>
  );
};
```

**Key detail:** Scenes always render at full 1080×1920 internally, then get scaled down via CSS transform when in stacked mode. This means scene code doesn't need to know about layout.

#### VideoClipLayer

Renders YouTube clip overlays per scene using `<OffthreadVideo>`.

**Scene timing derivation:** `scenes.json` uses `"frames": [start, end]` array format. The clip's `<Sequence>` props are derived as:
- `from = scene.frames[0]`
- `durationInFrames = scene.frames[1] - scene.frames[0]`

```tsx
// Each clip renders fullscreen during its scene's time range
<Sequence from={scene.frames[0]} durationInFrames={scene.frames[1] - scene.frames[0]}>
  <OffthreadVideo
    src={staticFile(`scene${sceneId}-youtube-clip.mp4`)}
    startFrom={trimStartFrames}
    endAt={trimEndFrames}
    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
  />
</Sequence>
```

**Fallback:** If a clip file fails to load, render nothing (skip the layer). The scene's generated visuals remain visible underneath.

#### SubtitleLayer

React-rendered captions replacing ASS subtitle generation (~870 lines of ASS logic).

**Inputs:**
- `subtitles: SubtitleItem[]` — word timings and text (from `@viona/renderer`)
- `videoRect: Rect` — current animated video area (captions position relative to this, NOT a static mode check)
- `captionStyle: CaptionStyle` — full styling (defined in `apps/web/src/features/editor-v2/store/types.ts` lines 301+, ~20 fields including nested `AnimationConfig`, `StrokeStyle`, `CaptionEffects`)
- `captionPosition: CaptionPosition` — anchor-based or free positioning with `mode: 'anchor' | 'free'`, offsets, rotation, textAlign

**Caption features to support (phased):**

Phase 2a (MVP):
- Word-by-word and phrase display modes
- Active word highlighting (`activeColor`, `activeBackgroundColor`)
- Anchor-based positioning (top/center/bottom with offsets)
- Text stroke (`WebkitTextStroke`)
- Primary shadow effect (`textShadow`)
- Font family, size, weight, color, letterSpacing, lineHeight, textTransform

Phase 2b (full parity):
- Free-mode positioning (absolute x/y/width)
- Karaoke display mode
- Secondary shadow + glow effects (`filter: drop-shadow()`)
- Background padding + border radius on active words
- Per-word style overrides (`WordStyleOverrides`)
- Dynamic hierarchy (emotional segmentation, power/filler word classification)

**Rendering approach:**
- Each caption group renders as a `<div>` with absolute positioning
- Active word highlighted via `activeColor` / `activeBackgroundColor`
- Position calculated relative to `videoRect` (the animated rect, which smoothly transitions between layouts)
- Text effects rendered via CSS `textShadow`, `WebkitTextStroke`, `filter`

**Caption position logic:**
```tsx
// Always use the interpolated videoRect — it already animates during transitions.
// Do NOT check layout mode; the rect itself encodes the current layout state.
const effectiveArea = videoRect;
const anchorY = anchor === 'bottom'
  ? effectiveArea.y + effectiveArea.h - marginV
  : anchor === 'top'
    ? effectiveArea.y + marginV
    : effectiveArea.y + effectiveArea.h / 2;
```

### Data Flow

#### Input Props (passed via `--props` to `remotion render`)

```typescript
// NEW type — replaces the three separate segment arrays
// (fullscreenVisualSegments, overlaySegments, gapSegments)
interface LayoutSegment {
  startFrame: number;                    // Converted from ms: Math.round(startMs / 1000 * fps)
  endFrame: number;                      // Converted from ms: Math.round(endMs / 1000 * fps)
  displayMode: 'default' | 'fullscreen' | 'overlay';  // Normalized (no 'pip')
  overlayOpacity?: number;               // Default 0.85, only relevant for overlay mode
}

interface FullCompositionProps {
  // Layout
  layoutSettings: LayoutSettings;        // Stacked mode, ratio, gap
  layoutSegments: LayoutSegment[];       // Unified display mode timeline

  // Speaker video
  videoCropSettings: VideoCropSettings;  // cropX, cropY, scale

  // Subtitles
  subtitleData: SubtitleItem[];          // Word timings + styling
  captionStyle: CaptionStyle;           // See apps/web/.../store/types.ts lines 301+
  captionPosition: CaptionPosition;     // See apps/web/.../store/types.ts lines 180-201

  // Video clips
  videoClips: Array<{
    sceneId: string;
    filePath: string;                    // staticFile path
    trimStartMs: number;
    trimEndMs: number;
  }>;
}
```

**Scenes, TIMING, COLORS** remain in the existing `constants.ts` / scene files — no change there.

#### Worker Pipeline Changes

**Before render:**
1. Copy `source.mp4` to Remotion project's `public/` directory
2. Copy downloaded YouTube clips to `public/`
3. Generate `composition-props.json` with the above interface
4. Pass as `--props composition-props.json` to `remotion render`

**After render:**
```bash
# If enhanced audio exists, mux it in:
ffmpeg -i remotion-output.mp4 -i enhanced-audio.m4a -c:v copy -c:a aac -shortest output.mp4

# Otherwise, Remotion output IS the final output (it includes source audio via <OffthreadVideo>)
```

### Transition Behavior

#### Fixed Parameters
- **Duration:** 12 frames (400ms at 30fps)
- **Style:** Linear interpolation (smooth slide/resize)
- **Trigger:** Whenever `displayMode` changes between adjacent segments

#### Transition Examples

**Stacked → Fullscreen (visuals-first):**
- Visuals rect: `{y:0, h:960}` → `{y:0, h:1920}` (expands down)
- Video rect: `{y:960, h:960}` → `{y:1920, h:0}` (slides down off-canvas)
- Captions: reposition from video area to full canvas bottom

**Fullscreen → Stacked (visuals-first):**
- Reverse of above

**Stacked → Overlay:**
- Video rect: `{y:960, h:960}` → `{y:0, h:1920}` (expands to fill)
- Visuals rect: `{y:0, h:960}` → `{y:0, h:1920}` (expands to fill)
- Visuals opacity: `1.0` → `0.85` (becomes overlay)

**Overlay → Stacked:**
- Reverse of above

**Overlay → Fullscreen:**
- Video rect: `{y:0, h:1920}` → `{y:1920, h:0}` (slides out)
- Visuals opacity: `0.85` → `1.0`
- Visuals rect stays `{y:0, h:1920}` (already fullscreen)

**Fullscreen → Overlay:**
- Video rect: `{y:1920, h:0}` → `{y:0, h:1920}` (slides in from below)
- Visuals opacity: `1.0` → `0.85`

### Stacked Layout Gap Handling

When `layoutSettings.split.gap > 0`, a gap (solid black or configurable color) separates the two sections:

```
visualsHeight = round((1920 - gap) * (ratio / 100))
videoHeight = round((1920 - gap) * (1 - ratio / 100))
gapY = visualsHeight  (for visuals-first)
videoY = visualsHeight + gap
```

During transitions to/from fullscreen, the gap smoothly collapses to 0.

### PiP Layout Mode

PiP mode is **deferred** — not in scope for this migration. The primary use case is stacked layout (confirmed by user). PiP mode will continue using the existing FFmpeg composition path as a fallback until a future phase adds PiP support to the Remotion composition.

During Phase 1-3, the worker checks `layoutSettings.mode`:
- `'stacked'` → new Remotion full composition path
- `'pip'` → existing FFmpeg composition path (unchanged)

### Overlay Zones

The codebase has an `OverlayZone` type (`'behind' | 'lower-third' | 'top' | 'frame' | 'background' | 'none'`) for zone-based visual positioning. This is **out of scope** for the initial migration. Zone-based overlays currently only affect how visuals are positioned within scenes — they don't affect the outer layout composition. If zone-based visuals need layout-level changes in the future, they can be added to LayoutManager as an extension.

### Audio Handling

`<OffthreadVideo>` on the speaker video is rendered **muted** (`muted={true}`). Audio is handled separately:
- If enhanced audio exists: FFmpeg muxes it with the Remotion output
- If no enhanced audio: FFmpeg extracts audio from `source.mp4` and muxes it

This keeps audio handling simple and avoids double-audio issues.

```bash
# Always mux audio separately
ffmpeg -i remotion-output.mp4 -i source.mp4 -map 0:v -map 1:a -c:v copy -c:a aac output.mp4
# Or with enhanced audio:
ffmpeg -i remotion-output.mp4 -i enhanced-audio.m4a -map 0:v -map 1:a -c:v copy -c:a aac output.mp4
```

### Error Handling / Fallbacks

- **Speaker video fails to load:** Render black rectangle in video area (matches current FFmpeg behavior when source is missing)
- **YouTube clip file missing:** Skip the clip layer; scene visuals remain visible underneath
- **Subtitle data missing/empty:** Skip subtitle layer entirely (no crash)

## What Gets Deleted

### FFmpeg Composition Logic (~500 lines in `ffmpeg.ts`)
- `buildPiPComposition()` — PiP overlay positioning, border radius, rotation
- `buildStackedComposition()` — vstack/hstack with crop
- Three-layer filter chain (fullscreen segments, gap segments, overlay segments)
- Stream splitting for fade interference prevention
- Video clip overlay filter construction
- Subtitle burn-in filters

### ASS Subtitle Generation (~300 lines in `subtitles.ts`)
- `generateASSSubtitles()` — full ASS file generation
- `hexToASSColor()` — color format conversion
- Layout-aware margin calculations
- Font size multiplier corrections (no longer needed — React uses CSS directly)

### Segment Extraction Logic (in `index.ts`)
- `fullscreenVisualSegments` / `overlaySegments` / `gapSegments` computation
- Transition duration calculations
- Display mode change detection

**Replaced with:** ~150 lines of React components + ~50 lines of simplified FFmpeg (audio mux only).

## What Stays the Same

- **Scene components** (Scene1.tsx, etc.) — unchanged, render at 1080×1920 internally
- **constants.ts** — COLORS, TIMING, SPRINGS unchanged
- **Director/Animator prompts** — unchanged (they don't know about the outer composition)
- **scenes.json format** — unchanged
- **Visual generation pipeline** — unchanged
- **Video clip download** (yt-dlp) — unchanged, just copies to different location

## New Files

```
packages/worker/remotion-template/src/composition/
├── FullComposition.tsx          # Root composition with all layers
├── LayoutManager.tsx            # Display mode transition orchestrator
├── SpeakerVideo.tsx             # <OffthreadVideo> wrapper with crop
├── VisualsLayer.tsx             # Wraps existing scene tree with scaling
├── VideoClipLayer.tsx           # YouTube clip overlays
├── SubtitleLayer.tsx            # React-rendered captions
├── CaptionWord.tsx              # Single word with highlight state
├── types.ts                     # Rect, LayoutSegment, etc.
└── utils.ts                     # Rect interpolation helpers
```

## Migration Strategy

### Phase 1: LayoutManager + SpeakerVideo + VisualsLayer
- Get the basic layout working with animated transitions
- Speaker video renders via `<OffthreadVideo>`
- Visuals layer wraps existing scene tree
- FFmpeg still handles subtitles and audio

### Phase 2: SubtitleLayer
- Move caption rendering to React
- Delete ASS generation
- Match existing caption styling pixel-perfectly

### Phase 3: VideoClipLayer + Cleanup
- Move YouTube clip overlays into Remotion
- Delete FFmpeg composition code
- FFmpeg reduces to audio mux only

### Phase 4: Preview Integration
- Web editor preview uses the same FullComposition
- Real-time layout transition preview in the editor

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `<OffthreadVideo>` performance in SSR | Remotion's `--concurrency` flag; video is pre-downloaded locally |
| Caption rendering mismatch vs ASS | Side-by-side comparison during migration; keep ASS as fallback until Phase 2 validated |
| Scene scaling artifacts | Scenes render at native 1080×1920, CSS `transform: scale()` handles display — no rasterization quality loss |
| Render time increase | Minimal — Remotion already renders frames; compositing in React vs FFmpeg is comparable |
| `source.mp4` file access in Remotion | Copy to `public/` dir before render; `staticFile()` serves it |

## Constraints

- `interpolate()` MUST use `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` everywhere
- `inputRange` arrays MUST be strictly monotonically increasing
- Transition duration fixed at 12 frames (400ms) — no per-scene configuration
- Scenes always render internally at native canvas size (from `useVideoConfig()`) regardless of display mode
- `<OffthreadVideo>` requires the video file accessible via `staticFile()` or absolute URL
- `<OffthreadVideo>` for speaker video is always `muted={true}` — audio muxed separately by FFmpeg
- PiP layout mode is out of scope — falls back to existing FFmpeg path
- Overlay zones are out of scope — no layout-level changes needed
