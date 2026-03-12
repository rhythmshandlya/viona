<!-- Composition Assembly Guide — loaded by the Animator after all segments are implemented -->

# Composition Assembly

After generating all segment animations (`segments/Segment1.tsx`, `Segment2.tsx`, etc.), you MUST create `Composition.tsx` that assembles everything: the background video, each segment's visuals, and root-level subtitles.

## Directory Structure

```
src/{project_id}/
  segments/
    Segment1.tsx
    Segment2.tsx
    Segment3.tsx
    ...
  components/
    Background.tsx
    ...shared components...
  Composition.tsx      ← YOU CREATE THIS
  constants.ts
```

## Segment Component Contract

Every segment file exports a single component with this signature:

```tsx
export interface SegmentProps {
  width: number;
  height: number;
}

export const Segment1: React.FC<SegmentProps> = ({ width, height }) => {
  // All sizing derived from width/height props — NOT from useVideoConfig()
  // useCurrentFrame() is 0-relative inside <Sequence>
  // ...
};
```

Segments receive `width` and `height` from Composition.tsx based on their layout. A stacked segment's visuals panel gets `height * 0.3`, a fullscreen segment gets the full `height`, an overlay gets its positioned dimensions.

## 5 CRITICAL RULES

### Rule 1: Persistent Audio Carrier
A single `<OffthreadVideo>` with audible playback runs for the ENTIRE composition duration. It is 1x1px and invisible. This is the ONLY element that plays audio. Without it, the final render is silent.

```tsx
<OffthreadVideo
  src={videoUrl}
  style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
/>
```

### Rule 2: Muted Per-Segment Video
Any `<OffthreadVideo>` rendered inside a segment's Sequence (for stacked or overlay layouts) MUST have `muted` prop. Two audible video elements = audio glitch.

```tsx
<OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
```

### Rule 3: Root-Level Subtitles
Subtitles render at the ROOT of the composition using absolute timestamps (`currentTimeMs`). They are NOT inside any Sequence. They sit above all segments so they are always visible.

### Rule 4: Segment Dimension Props
Pass `width` and `height` to each segment matching its actual rendered area. Stacked layout bottom panel: `width={width}` and `height={visualsH}`. Overlay positioned box: `width={Math.round(width * 0.4)}` and `height={Math.round(height * 0.35)}`. Fullscreen: `width={width}` and `height={height}`.

### Rule 5: Frame Timing from scenes.json
Each `<Sequence from={...} durationInFrames={...}>` uses the exact frame values from scenes.json. `from` = segment start frame. `durationInFrames` = segment end - segment start. Do NOT hardcode frame numbers — compute from constants.ts TIMING object.

## Full Example Composition.tsx

This example shows three segments: stacked (70/30), fullscreen, and overlay.

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
      {/* CRITICAL: Persistent audio carrier — runs entire duration, invisible */}
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

## Layout Patterns

### Stacked Layout (video top, visuals bottom)

The most common layout. Video occupies the top portion, animated visuals fill the bottom.

```tsx
{/* Stacked: 70% video / 30% visuals */}
<Sequence from={TIMING.segmentNStart} durationInFrames={TIMING.segmentNEnd - TIMING.segmentNStart}>
  <div style={{ position: 'absolute', left: 0, top: 0, width, height: videoH70, overflow: 'hidden' }}>
    <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
  <div style={{ position: 'absolute', top: videoH70, width, height: visualsH30, overflow: 'hidden' }}>
    <SegmentN width={width} height={visualsH30} />
  </div>
</Sequence>
```

The split ratio (70/30, 60/40, 50/50) comes from scenes.json. Compute `videoH` and `visualsH` accordingly.

### Fullscreen Layout (visuals only, audio from carrier)

No visible video. The segment's visuals fill the entire canvas. Audio continues from the persistent carrier.

```tsx
{/* Fullscreen: visuals fill entire canvas */}
<Sequence from={TIMING.segmentNStart} durationInFrames={TIMING.segmentNEnd - TIMING.segmentNStart}>
  <SegmentN width={width} height={height} />
</Sequence>
```

### Overlay Layout (visuals on top of video)

Full video background with positioned visual overlay. Use for talking-head annotations and lightweight graphics.

```tsx
{/* Overlay: visuals positioned on top of full video */}
<Sequence from={TIMING.segmentNStart} durationInFrames={TIMING.segmentNEnd - TIMING.segmentNStart}>
  <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
    <OffthreadVideo src={videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </div>
  <div style={{ position: 'absolute', left: '10%', top: '60%', width: '40%', height: '35%' }}>
    <SegmentN width={Math.round(width * 0.4)} height={Math.round(height * 0.35)} />
  </div>
</Sequence>
```

Overlay position and size come from scenes.json `safePlacement`. Adjust percentages to avoid the speaker's face.

## Adapting to Your Project

The example above is a template. Your actual Composition.tsx must:

1. **Match scenes.json** — read each segment's `frames`, `layout`, and `safePlacement` fields
2. **Import your actual segments** — `Segment1`, `Segment2`, etc. as generated
3. **Compute layout dimensions** from the split ratios in scenes.json (not hardcoded 70/30)
4. **Use TIMING from constants.ts** for all `from` and `durationInFrames` values
5. **Handle transitions** — if the Director specified crossfade/slide between segments, use `TransitionSeries` instead of plain `Sequence`
