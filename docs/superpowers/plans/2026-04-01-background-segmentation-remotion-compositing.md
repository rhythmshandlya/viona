# Background Segmentation: Remotion Compositing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Remotion layer compositing system — SandwichComposite, BehindSpeaker/InFrontOfSpeaker wrappers, shared depth utilities, and depth template variants.

**Architecture:** SandwichComposite uses HTML5 Canvas with globalCompositeOperation to extract the person via matte video. BehindSpeaker/InFrontOfSpeaker wrappers route elements to scene-bg/scene-fg tracks. Depth templates extend existing magazine/explainer templates with speaker-aware positioning.

**Tech Stack:** React, Remotion, HTML5 Canvas, TypeScript

---

## Task 1: SandwichComposite component

The core compositing component. Renders three layers: background video, children (mid-layer), and person extracted via canvas matte compositing.

- [ ] **1.1** Create `packages/sandbox/template/src/composition/SandwichComposite.tsx`

This component accepts the source video, matte video, a frame offset, and children (mid-layer content). It uses an HTML5 Canvas to extract the person-only pixels by drawing the source frame then applying the matte as an alpha channel via `globalCompositeOperation: 'destination-in'`.

```tsx
// packages/sandbox/template/src/composition/SandwichComposite.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import {
  AbsoluteFill,
  Video,
  useCurrentFrame,
  useVideoConfig,
  getRemotionEnvironment,
  staticFile,
} from 'remotion';

interface SandwichCompositeProps {
  videoSrc: string;
  matteSrc: string;
  startFrom: number;
  children: React.ReactNode;
}

/**
 * Three-layer sandwich composite:
 *   Layer 0: Original video (background) — fills entire canvas
 *   Layer 1: {children} — mid-layer animations (behind person)
 *   Layer 2: Person extracted via canvas matte compositing (on top)
 *
 * Video sync strategy:
 *   Both the source and matte videos render as Remotion <Video> components
 *   inside hidden (opacity: 0) divs. Remotion's <Video> handles frame-seeking
 *   during both preview playback and server-side rendering. The canvas reads
 *   pixel data from these DOM <video> elements on every frame tick, ensuring
 *   the composite is always frame-accurate.
 *
 * Canvas approach:
 *   1. Draw source video frame onto canvas
 *   2. Set globalCompositeOperation to 'destination-in'
 *   3. Draw matte frame — white pixels = keep, black = discard
 *   4. Result: person-only pixels on transparent background
 */
export const SandwichComposite: React.FC<SandwichCompositeProps> = ({
  videoSrc,
  matteSrc,
  startFrom,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const matteVideoRef = useRef<HTMLVideoElement>(null);

  const resolvedVideoSrc = resolveSrc(videoSrc);
  const resolvedMatteSrc = resolveSrc(matteSrc);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const sourceVideo = sourceVideoRef.current;
    const matteVideo = matteVideoRef.current;
    if (!canvas || !sourceVideo || !matteVideo) return;
    if (sourceVideo.readyState < 2 || matteVideo.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Step 1: Draw source video frame (person + background)
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sourceVideo, 0, 0, width, height);

    // Step 2: Apply matte as alpha mask
    // 'destination-in' keeps existing pixels only where the new draw is opaque.
    // The matte is white (opaque) where the person is, black (transparent) elsewhere.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(matteVideo, 0, 0, width, height);

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [width, height]);

  // Re-render canvas every frame — Remotion <Video> handles seeking,
  // so by the time useEffect fires the video elements are at the correct frame.
  useEffect(() => {
    renderCanvas();
  }, [frame, renderCanvas]);

  const startFromFrames = Math.round((startFrom / 1000) * fps);

  return (
    <AbsoluteFill>
      {/* Layer 0: Original video (background — visible through gaps) */}
      <AbsoluteFill>
        <Video
          src={resolvedVideoSrc}
          startFrom={startFromFrames}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          pauseWhenBuffering
        />
      </AbsoluteFill>

      {/* Layer 1: Mid-layer children (animations behind the person) */}
      <AbsoluteFill>
        {children}
      </AbsoluteFill>

      {/* Layer 2: Person extracted via canvas matte */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {/*
         * Hidden Remotion <Video> elements for canvas reads.
         * Using Remotion's <Video> (not raw <video>) ensures frame-accurate
         * seeking during both preview and server-side rendering. The elements
         * are visually hidden (opacity: 0) but remain in the DOM so the canvas
         * can drawImage() from them.
         *
         * We attach refs via the callback pattern to capture the underlying
         * <video> DOM element that Remotion's <Video> renders.
         */}
        <Video
          ref={sourceVideoRef}
          src={resolvedVideoSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          pauseWhenBuffering
          muted
          onLoadedData={renderCanvas}
        />
        <Video
          ref={matteVideoRef}
          src={resolvedMatteSrc}
          startFrom={startFromFrames}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          pauseWhenBuffering
          muted
          onLoadedData={renderCanvas}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: '100%' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Resolve src path — in render mode use staticFile, otherwise pass through */
function resolveSrc(src: string): string {
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  const { isRendering } = getRemotionEnvironment();
  if (isRendering) return staticFile(src);
  return src;
}

export default SandwichComposite;
```

- [ ] **1.2** Export `SandwichComposite` from `packages/sandbox/template/src/composition/index.ts`

```tsx
// Add to packages/sandbox/template/src/composition/index.ts
// (Add this line alongside existing exports)
export { SandwichComposite } from './SandwichComposite';
```

- [ ] **1.3** Verify build compiles by running TypeScript check

```bash
cd /workspace && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 2: BehindSpeaker / InFrontOfSpeaker layer wrappers

Scene components return elements wrapped in `<BehindSpeaker>` and `<InFrontOfSpeaker>`. These are simple marker components that the `PlayerComposition` routes to the correct track layer.

- [ ] **2.1** Create `packages/sandbox/template/src/composition/DepthLayers.tsx`

```tsx
// packages/sandbox/template/src/composition/DepthLayers.tsx
import React, { createContext, useContext } from 'react';

/**
 * Depth layer context — used by PlayerComposition to collect
 * behind-speaker and in-front-of-speaker children from scene renders.
 *
 * When rendering outside a depth context (e.g., in the playground or
 * in a non-depth scene), both wrappers render children inline — no
 * layer splitting.
 */

interface DepthLayerContextValue {
  /** Register content for the behind-speaker (scene-bg) layer */
  registerBehind: (node: React.ReactNode) => void;
  /** Register content for the in-front-of-speaker (scene-fg) layer */
  registerFront: (node: React.ReactNode) => void;
  /** Whether we are inside a depth-aware rendering context */
  active: boolean;
}

const DepthLayerContext = createContext<DepthLayerContextValue>({
  registerBehind: () => {},
  registerFront: () => {},
  active: false,
});

export const DepthLayerProvider = DepthLayerContext.Provider;
export const useDepthLayer = () => useContext(DepthLayerContext);

/**
 * BehindSpeaker — wraps elements that render behind the person.
 *
 * In a depth-aware context: elements are extracted to the scene-bg track
 * (position 1), which renders below the person matte layer.
 *
 * Outside depth context (playground, non-depth scenes): renders inline
 * as a transparent AbsoluteFill — no visual difference.
 */
export const BehindSpeaker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { active, registerBehind } = useDepthLayer();

  if (active) {
    // In depth context, register children for the bg layer
    // and render nothing here — PlayerComposition places them
    registerBehind(children);
    return null;
  }

  // Fallback: render inline (non-depth context)
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
};

/**
 * InFrontOfSpeaker — wraps elements that render in front of the person.
 *
 * In a depth-aware context: elements are extracted to the scene-fg track
 * (position 3), which renders above the person matte layer.
 *
 * Outside depth context: renders inline.
 */
export const InFrontOfSpeaker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { active, registerFront } = useDepthLayer();

  if (active) {
    registerFront(children);
    return null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
};
```

- [ ] **2.2** Export from `packages/sandbox/template/src/composition/index.ts`

```tsx
// Add alongside existing exports
export { BehindSpeaker, InFrontOfSpeaker, DepthLayerProvider, useDepthLayer } from './DepthLayers';
```

---

## Task 3: Integrate depth layers into PlayerComposition

Update `PlayerComposition.tsx` to handle the 5-track depth structure. When a `person` track exists in the manifest, enable the sandwich composite. Scene items on `scene-bg` and `scene-fg` tracks render at the correct depth positions.

- [ ] **3.1** Update `packages/sandbox/template/src/PlayerComposition.tsx` to support the person track

Add person track handling. When a track of type `person` exists, render the `SandwichComposite` at that track's position. The person track item carries `data.matteSrc` and `data.videoSrc`.

```tsx
// In PlayerComposition.tsx — update the ItemRenderer switch statement
// Add a new case for the 'person' item type:

case 'person': {
  return (
    <PersonItem
      data={item.data}
      assets={assets}
      fps={fps}
    />
  );
}
```

- [ ] **3.2** Create `packages/sandbox/template/src/items/PersonItem.tsx`

This component delegates to `SandwichComposite` from Task 1 for the actual canvas matte compositing. `PersonItem` is the track-system adapter: it resolves asset paths via the manifest's `assets` map and converts `startFrom` from milliseconds to the format `SandwichComposite` expects. The compositing logic lives in one place (`SandwichComposite`), and `PersonItem` wraps it for the PlayerComposition item renderer.

```tsx
// packages/sandbox/template/src/items/PersonItem.tsx
import React from 'react';
import { SandwichComposite } from '../composition/SandwichComposite';
import { resolveMediaSrc } from './resolveMediaSrc';

interface PersonItemData {
  videoSrc: string;
  matteSrc: string;
  startFrom?: number;
  crop?: { x: number; y: number; scale: number };
}

interface PersonItemProps {
  data: PersonItemData;
  assets: Record<string, string>;
  fps: number;
}

/**
 * Track-system adapter for person matte compositing.
 *
 * Delegates to SandwichComposite for the actual canvas matte logic.
 * PersonItem handles:
 *   - Asset path resolution via the manifest's assets map
 *   - startFrom conversion (ms in manifest data)
 *   - Future: crop/reframe transforms
 *
 * In the 5-track depth structure, PersonItem renders on the "person" track
 * (position 2), above scene-bg and below scene-fg. The SandwichComposite
 * renders the person-only pixels (Layer 2) — the background video (Layer 0)
 * and mid-layer children (Layer 1) are handled by the other tracks, so we
 * pass an empty fragment as children here. The full sandwich is assembled
 * by the track ordering in PlayerComposition.
 */
export const PersonItem: React.FC<PersonItemProps> = React.memo(({
  data,
  assets,
  fps,
}) => {
  const videoSrc = resolveMediaSrc(data.videoSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFrom = data.startFrom ?? 0;

  return (
    <SandwichComposite
      videoSrc={videoSrc}
      matteSrc={matteSrc}
      startFrom={startFrom}
    >
      {/* No mid-layer children — in the track system, scene-bg/scene-fg
          tracks handle the behind/in-front layers separately. */}
      <></>
    </SandwichComposite>
  );
});
```

- [ ] **3.3** Export PersonItem from `packages/sandbox/template/src/items/index.tsx`

Add to the existing exports:

```tsx
export { PersonItem } from './PersonItem';
```

- [ ] **3.4** Wire PersonItem into the ItemRenderer switch in PlayerComposition.tsx

In `packages/sandbox/template/src/PlayerComposition.tsx`, add the import:

```tsx
import { VideoItem, AudioItem, TextItem, ImageItem, SceneItem as SceneItemComponent, ShapeItem, CaptionItem, PersonItem } from './items';
```

And add the case in `ItemRenderer`:

```tsx
case 'person':
  return <PersonItem data={item.data} assets={assets} fps={fps} />;
```

- [ ] **3.5** Verify the build compiles cleanly

```bash
cd /workspace && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 4: Shared depth utilities

Three utility components for depth templates: `SpeakerAwareLayout`, `DepthEntrance`, and `DepthParallax`.

> **Note:** These are optional convenience wrappers that templates MAY use but are not required. The 9 depth templates in Tasks 5-13 use inline positioning with `computeSpeakerPx`/`computeVisibleZones` directly, which is equally valid. These utilities are bundled via `sharedDepthNames` so templates can adopt them if desired, but they are not dead code that needs cleanup -- they exist as a higher-level API for future templates or refactors.

- [ ] **4.1** Create `packages/templates/src/depth/types.ts`

Shared type definitions for speaker spatial data.

```tsx
// packages/templates/src/depth/types.ts

/** Normalized speaker bounding box (0-1 coordinates relative to canvas) */
export interface SpeakerBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixel-space speaker data (computed from normalized + canvas size) */
export interface SpeakerData {
  /** Normalized bounding box (0-1) */
  bbox: SpeakerBbox;
  /** Face center (0-1) */
  center: { x: number; y: number };
  /** Pixel-space bounding box */
  bboxPx: { x: number; y: number; w: number; h: number };
  /** Pixel-space center */
  centerPx: { x: number; y: number };
}

/** Areas not occluded by the speaker (pixel-space) */
export interface VisibleZones {
  left: { x: number; y: number; w: number; h: number };
  right: { x: number; y: number; w: number; h: number };
  top: { x: number; y: number; w: number; h: number };
  bottom: { x: number; y: number; w: number; h: number };
}

/**
 * Compute pixel-space speaker data from normalized bbox.
 * Used by depth templates to convert scene-level SPEAKER constants.
 */
export function computeSpeakerPx(
  bbox: SpeakerBbox,
  center: { x: number; y: number },
  canvasW: number,
  canvasH: number,
): { bboxPx: SpeakerData['bboxPx']; centerPx: SpeakerData['centerPx'] } {
  return {
    bboxPx: {
      x: Math.round(bbox.x * canvasW),
      y: Math.round(bbox.y * canvasH),
      w: Math.round(bbox.w * canvasW),
      h: Math.round(bbox.h * canvasH),
    },
    centerPx: {
      x: Math.round(center.x * canvasW),
      y: Math.round(center.y * canvasH),
    },
  };
}

/**
 * Compute visible zones (areas not behind the speaker) from speaker bbox.
 */
export function computeVisibleZones(
  bboxPx: SpeakerData['bboxPx'],
  canvasW: number,
  canvasH: number,
): VisibleZones {
  return {
    left: { x: 0, y: 0, w: bboxPx.x, h: canvasH },
    right: { x: bboxPx.x + bboxPx.w, y: 0, w: canvasW - (bboxPx.x + bboxPx.w), h: canvasH },
    top: { x: 0, y: 0, w: canvasW, h: bboxPx.y },
    bottom: { x: 0, y: bboxPx.y + bboxPx.h, w: canvasW, h: canvasH - (bboxPx.y + bboxPx.h) },
  };
}
```

- [ ] **4.2** Create `packages/templates/src/depth/SpeakerAwareLayout.tsx`

Positions children relative to the speaker bounding box. Provides named layout methods for common depth interactions.

```tsx
// packages/templates/src/depth/SpeakerAwareLayout.tsx
import React from 'react';
import type { SpeakerData, VisibleZones } from './types';

interface SpeakerAwareLayoutProps {
  speaker: SpeakerData;
  zones: VisibleZones;
  /**
   * Layout mode:
   * - 'peekLeft': Content positioned to peek from behind speaker's left side
   * - 'peekRight': Content positioned to peek from behind speaker's right side
   * - 'behindCenter': Content centered behind speaker's torso
   * - 'flanking': Content split to both sides of speaker
   */
  mode: 'peekLeft' | 'peekRight' | 'behindCenter' | 'flanking';
  /** Horizontal padding from speaker edge in px */
  peekOffset?: number;
  children: React.ReactNode;
}

/**
 * Positions children relative to the speaker's silhouette.
 *
 * Each mode places content so it partially overlaps the speaker bbox,
 * creating the "peek from behind" depth effect when rendered on the
 * scene-bg track (below the person matte layer).
 */
export const SpeakerAwareLayout: React.FC<SpeakerAwareLayoutProps> = ({
  speaker,
  zones,
  mode,
  peekOffset = 40,
  children,
}) => {
  const { bboxPx, centerPx } = speaker;

  const style: React.CSSProperties = {
    position: 'absolute',
  };

  switch (mode) {
    case 'peekLeft': {
      // Position so right edge extends into speaker bbox
      // Content starts in left visible zone and extends behind speaker's left side
      style.right = undefined;
      style.left = zones.left.w - peekOffset;
      style.top = bboxPx.y + bboxPx.h * 0.2;
      break;
    }
    case 'peekRight': {
      // Position so left edge extends into speaker bbox
      style.left = bboxPx.x + bboxPx.w - peekOffset;
      style.top = bboxPx.y + bboxPx.h * 0.2;
      break;
    }
    case 'behindCenter': {
      // Center behind speaker's torso (chest height)
      style.left = centerPx.x;
      style.top = centerPx.y;
      style.transform = 'translate(-50%, -50%)';
      break;
    }
    case 'flanking': {
      // Full width — children are responsible for positioning left/right halves
      style.left = 0;
      style.right = 0;
      style.top = bboxPx.y + bboxPx.h * 0.15;
      break;
    }
  }

  return <div style={style}>{children}</div>;
};
```

- [ ] **4.3** Create `packages/templates/src/depth/DepthEntrance.tsx`

Animated entrance from behind speaker center, expanding outward.

```tsx
// packages/templates/src/depth/DepthEntrance.tsx
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface DepthEntranceProps {
  /** Frame at which the entrance animation starts */
  startFrame: number;
  /** Duration of the entrance in frames (default 25) */
  duration?: number;
  /** Speaker center in pixels (origin for the expand-out) */
  originX: number;
  originY: number;
  children: React.ReactNode;
}

/**
 * Animated entrance from behind the speaker's center.
 *
 * The element starts at scale 0.3 centered on the speaker's torso,
 * then expands outward to full size. Combined with the person matte
 * layer on top, this creates the illusion of emerging from behind.
 */
export const DepthEntrance: React.FC<DepthEntranceProps> = ({
  startFrame,
  duration = 25,
  originX,
  originY,
  children,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.back(1.1)),
    },
  );

  const scale = interpolate(progress, [0, 1], [0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        transformOrigin: `${originX}px ${originY}px`,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **4.4** Create `packages/templates/src/depth/DepthParallax.tsx`

Parallax movement based on depth layer. Elements at different conceptual depths move at different rates, creating spatial separation.

```tsx
// packages/templates/src/depth/DepthParallax.tsx
import React from 'react';
import { useCurrentFrame } from 'remotion';

interface DepthParallaxProps {
  /**
   * Depth tier (0 = closest/largest movement, 1 = mid, 2 = far/subtle).
   * Higher depth = less movement = feels farther away.
   */
  depth: number;
  /** Maximum parallax amplitude in pixels (default 12) */
  amplitude?: number;
  /** Unique seed for phase offset to prevent synchronised drift */
  seed?: number;
  /** Frame after which parallax begins (default 60 — after entrance) */
  startAfterFrame?: number;
  children: React.ReactNode;
}

/**
 * Applies subtle sine-based parallax drift to children.
 *
 * Used by depth templates to create spatial separation between
 * elements at different conceptual depths. Near elements drift more,
 * far elements drift less.
 */
export const DepthParallax: React.FC<DepthParallaxProps> = ({
  depth,
  amplitude = 12,
  seed = 0,
  startAfterFrame = 60,
  children,
}) => {
  const frame = useCurrentFrame();

  const depthMultiplier = Math.max(0.2, 1 - depth * 0.3);
  const maxOffset = amplitude * depthMultiplier;

  const isActive = frame >= startAfterFrame;
  const driftX = isActive
    ? Math.sin(frame * 0.02 + seed * 1.5) * maxOffset
    : 0;
  const driftY = isActive
    ? Math.sin(frame * 0.025 + seed * 2.0) * maxOffset * 0.6
    : 0;

  return (
    <div
      style={{
        transform: `translate(${driftX}px, ${driftY}px)`,
        willChange: isActive ? 'transform' : undefined,
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **4.5** Create `packages/templates/src/depth/index.ts` barrel export

```tsx
// packages/templates/src/depth/index.ts
export type { SpeakerBbox, SpeakerData, VisibleZones } from './types';
export { computeSpeakerPx, computeVisibleZones } from './types';
export { SpeakerAwareLayout } from './SpeakerAwareLayout';
export { DepthEntrance } from './DepthEntrance';
export { DepthParallax } from './DepthParallax';
```

- [ ] **4.6** Export depth utilities from `packages/templates/src/index.ts`

Add at the bottom of the file:

```tsx
// Depth compositing utilities
export {
  SpeakerAwareLayout,
  DepthEntrance,
  DepthParallax,
  computeSpeakerPx,
  computeVisibleZones,
} from './depth';
export type { SpeakerBbox, SpeakerData, VisibleZones } from './depth';
```

---

## Task 5: Magazine depth template — magazine-stats-depth

Oversized stat cards scatter across the full canvas. Cards behind the speaker are partially occluded by the person layer. Speaker's silhouette becomes a natural divider between data points.

- [ ] **5.1** Create `packages/templates/src/templates/magazine-stats-depth/schema.ts`

Extends the base magazine-stats schema with speaker position data.

```tsx
// packages/templates/src/templates/magazine-stats-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  stats: z.array(z.object({
    value: z.string(),
    label: z.string(),
    unit: z.string().optional(),
  })).min(2).max(6).default([
    { value: '44.1M', label: 'Population' },
    { value: '$200B', label: 'GDP' },
    { value: '603,628', label: 'Area (km\u00B2)' },
    { value: '24', label: 'Regions' },
  ]),
  title: z.string().default('Ukraine at a Glance'),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineStatsDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineStatsDepthProps = schema.parse({});
```

- [ ] **5.2** Create `packages/templates/src/templates/magazine-stats-depth/index.tsx`

Full-canvas stat layout that positions cards to peek from behind the speaker's edges.

```tsx
// packages/templates/src/templates/magazine-stats-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineStatsDepthProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { StatCard } from '../magazine-stats/components/StatCard';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const STAT_W = 500;
const STAT_H = 320;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right' | 'up' | 'down'> = ['left', 'right', 'up', 'down'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

/**
 * Position stat cards to peek from behind the speaker's edges.
 * Cards are placed at shoulder/torso height — partially occluded by
 * the person matte for the depth effect, fully visible in the side zones.
 */
function getDepthStatPosition(
  index: number,
  count: number,
  speakerPx: { x: number; y: number; w: number; h: number },
  zones: ReturnType<typeof computeVisibleZones>,
): { x: number; y: number } {
  const speakerRight = speakerPx.x + speakerPx.w;
  const chestY = speakerPx.y + speakerPx.h * 0.3;

  // Alternate cards between left-peek, right-peek, and side zones
  const positions: Array<{ x: number; y: number }> = [
    // Card 0: left side, peeking behind left shoulder
    { x: zones.left.w - STAT_W * 0.4, y: chestY - 60 },
    // Card 1: right side, peeking behind right shoulder
    { x: speakerRight - STAT_W * 0.6, y: chestY + 40 },
    // Card 2: top-left visible zone
    { x: 40, y: CANVAS_H * 0.08 },
    // Card 3: bottom-right visible zone
    { x: CANVAS_W - STAT_W - 40, y: CANVAS_H * 0.78 },
    // Card 4: center-left, behind torso
    { x: zones.left.w - STAT_W * 0.2, y: chestY + 280 },
    // Card 5: center-right, behind torso
    { x: speakerRight - STAT_W * 0.8, y: chestY + 200 },
  ];

  const pos = positions[index % positions.length];
  const jitterX = (random(`depth-stat-jx-${index}`) - 0.5) * 40;
  const jitterY = (random(`depth-stat-jy-${index}`) - 0.5) * 40;
  return { x: pos.x + jitterX, y: pos.y + jitterY };
}

const MagazineStatsDepth: React.FC<MagazineStatsDepthProps> = ({
  stats = [],
  title,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const titleSlide = paperSlide(frame, 0, 15, 'up');

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title — in a visible zone (top area) */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={88} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="depth-stats-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={88} />
        </div>
      </div>

      {/* Stat cards — positioned to peek from behind speaker */}
      {stats.map((stat, i) => {
        const pos = getDepthStatPosition(i, stats.length, bboxPx, zones);
        const depth = i % 3;
        const depthMul = (depth + 1) * 10;

        const enterStart = 10 + i * STAGGER;
        const direction = DIRECTIONS[i % DIRECTIONS.length];
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, direction);
        const landFrame = enterStart + ENTER_DURATION;
        const countUpStart = landFrame + 10;

        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6 : 0;

        const isEntering = frame < landFrame;

        let x = pos.x + parallaxX;
        let y = pos.y + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <StatCard value={stat.value} label={stat.label} index={i} countUpStart={countUpStart} width={STAT_W} height={STAT_H} />
              {random(`depth-stat-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 50} />
              ) : (
                <PinMark x={STAT_W / 2} y={4} seed={i + 50} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineStatsDepth;
```

- [ ] **5.3** Create `packages/templates/src/templates/magazine-stats-depth/meta.json`

```json
{
  "slug": "magazine-stats-depth",
  "name": "Magazine Stats (Depth)",
  "description": "Oversized stat cards scattered across full canvas behind the speaker — cards peek from behind shoulders creating editorial depth",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "stats", "numbers", "data", "metrics", "depth"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

- [ ] **5.4** Create `packages/templates/src/templates/magazine-stats-depth/metadata.json`

```json
{
  "compositionId": "magazine-stats-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

- [ ] **5.5** Create `packages/templates/src/templates/magazine-stats-depth/register.ts`

```tsx
// packages/templates/src/templates/magazine-stats-depth/register.ts
import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta } from '../../types';
import { schema, defaultProps } from './schema';
import meta from './meta.json';
import compositionMeta from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: compositionMeta as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const magazineDir = path.join(dir, '../../magazine');
    const depthDir = path.join(dir, '../../depth');
    const statsDir = path.join(dir, '../magazine-stats');

    const ownFileNames = [
      'meta.json',
      'metadata.json',
      'schema.ts',
      'index.tsx',
      'register.ts',
    ];

    const sharedMagazineNames = [
      'constants.ts',
      'textures.tsx',
      'effects.tsx',
      'typography.tsx',
      'animations.ts',
      'decorations.tsx',
    ];

    const sharedDepthNames = [
      'types.ts',
      'SpeakerAwareLayout.tsx',
      'DepthEntrance.tsx',
      'DepthParallax.tsx',
      'index.ts',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));

    const magazineFiles = sharedMagazineNames.map((f) => ({
      path: `../../magazine/${f}`,
      content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
    }));

    const depthFiles = sharedDepthNames.map((f) => ({
      path: `../../depth/${f}`,
      content: fs.readFileSync(path.join(depthDir, f), 'utf-8'),
    }));

    // Include StatCard from base magazine-stats
    const baseComponents = [
      { path: '../magazine-stats/components/StatCard.tsx', content: fs.readFileSync(path.join(statsDir, 'components/StatCard.tsx'), 'utf-8') },
      { path: '../magazine-stats/components/CountUp.tsx', content: fs.readFileSync(path.join(statsDir, 'components/CountUp.tsx'), 'utf-8') },
    ];

    return [...ownFiles, ...magazineFiles, ...depthFiles, ...baseComponents];
  },
});
```

- [ ] **5.6** Add registry import to `packages/templates/src/index.ts`

Add after the magazine-stats import:

```tsx
import './templates/magazine-stats-depth/register';
```

- [ ] **5.7** Add entry to `packages/templates/registry.json`

Add the following object to the `items` array:

```json
{
  "name": "magazine-stats-depth",
  "type": "registry:component",
  "description": "Oversized stat cards scattered across full canvas behind the speaker — cards peek from behind shoulders creating editorial depth",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "stats", "numbers", "data", "metrics", "depth"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 6: Magazine depth template — magazine-timeline-depth

Timeline thread runs vertically behind the speaker. Event cards emerge from behind the speaker's shoulders, alternating left and right. Speaker stands "in front of history."

- [ ] **6.1** Create `packages/templates/src/templates/magazine-timeline-depth/schema.ts`

```tsx
// packages/templates/src/templates/magazine-timeline-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  events: z.array(z.object({
    year: z.string(),
    text: z.string(),
  })).min(2).max(6).default([
    { year: '1991', text: 'Independence declared' },
    { year: '2004', text: 'Orange Revolution' },
    { year: '2014', text: 'Revolution of Dignity' },
    { year: '2022', text: 'Full-scale invasion begins' },
  ]),
  title: z.string().default('Timeline'),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineTimelineDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineTimelineDepthProps = schema.parse({});
```

- [ ] **6.2** Create `packages/templates/src/templates/magazine-timeline-depth/index.tsx`

Thread runs behind the speaker center. Cards emerge from behind the shoulders, alternating sides. Thread node dots sit behind the speaker's torso.

```tsx
// packages/templates/src/templates/magazine-timeline-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineTimelineDepthProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { TimelineThread } from '../magazine-timeline/components/TimelineThread';
import { EventCard } from '../magazine-timeline/components/EventCard';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 80;
const TITLE_W = 800;
const TITLE_H = 140;
const CARD_H = 200;
const CARD_W = 440;
const STAGGER = 14;
const ENTER_DURATION = 25;

const MagazineTimelineDepth: React.FC<MagazineTimelineDepthProps> = ({
  events = [],
  title,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Timeline spans the full canvas height, centered on speaker
  const eventSpacing = Math.min(320, (CANVAS_H - 400) / Math.max(events.length, 1));
  const firstEventY = Math.max(280, centerPx.y - (events.length * eventSpacing) / 2);
  const eventYPositions = events.map((_, i) => firstEventY + i * eventSpacing);
  const threadStartY = firstEventY - 40;
  const threadEndY = eventYPositions[events.length - 1] + CARD_H + 40;

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const nodeLandFrames = events.map((_, i) => 20 + i * STAGGER + ENTER_DURATION);
  const nodeYPositions = eventYPositions.map((y) => y + CARD_H / 2);

  // Thread runs through speaker center X
  const threadX = centerPx.x;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={77} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="depth-timeline-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={77} />
        </div>
      </div>

      {/* Timeline thread — behind speaker center */}
      <div style={{ position: 'absolute', left: threadX - 2, top: 0, width: 4, height: CANVAS_H }}>
        <TimelineThread startY={threadStartY} endY={threadEndY} nodeYPositions={nodeYPositions} nodeLandFrames={nodeLandFrames} />
      </div>

      {/* Event cards — alternating sides, peeking from behind shoulders */}
      {events.map((event, i) => {
        const isLeft = i % 2 === 0;
        const enterStart = 20 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, isLeft ? 'left' : 'right');
        const landFrame = enterStart + ENTER_DURATION;

        const depth = i % 3;
        const depthMul = (depth + 1) * 8;
        const parallaxX = frame >= 70 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 70 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        // Position cards to peek from behind speaker's shoulders
        const baseX = isLeft
          ? bboxPx.x - CARD_W * 0.6   // Left card: extends behind left shoulder
          : bboxPx.x + bboxPx.w - CARD_W * 0.4; // Right card: extends behind right shoulder
        const baseY = eventYPositions[i];

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;
        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth + 1 }}>
            <EventCard year={event.year} text={event.text} index={i} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineTimelineDepth;
```

- [ ] **6.3** Create `meta.json`, `metadata.json`, `register.ts` for magazine-timeline-depth

**`packages/templates/src/templates/magazine-timeline-depth/meta.json`:**
```json
{
  "slug": "magazine-timeline-depth",
  "name": "Magazine Timeline (Depth)",
  "description": "Timeline thread runs behind the speaker with event cards emerging from behind shoulders, creating editorial depth",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "timeline", "history", "dates", "chronology", "depth"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

**`packages/templates/src/templates/magazine-timeline-depth/metadata.json`:**
```json
{
  "compositionId": "magazine-timeline-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/magazine-timeline-depth/register.ts`:** follows the same pattern as Task 5.5 — register with `registerTemplate`, `getFiles` includes own files + `../../magazine/*` shared files + `../../depth/*` shared files + `../magazine-timeline/components/TimelineThread.tsx` and `../magazine-timeline/components/EventCard.tsx` from the base template.

- [ ] **6.4** Add registry import and registry.json entry

Add `import './templates/magazine-timeline-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "magazine-timeline-depth",
  "type": "registry:component",
  "description": "Timeline thread runs behind the speaker with event cards emerging from behind shoulders, creating editorial depth",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "timeline", "history", "dates", "chronology", "depth"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 7: Magazine depth template — magazine-quote-depth

Large serif quote text fills the background behind the speaker. Speaker partially occludes the quote, creating a "words behind the person" editorial feel.

- [ ] **7.1** Create `packages/templates/src/templates/magazine-quote-depth/schema.ts`

```tsx
// packages/templates/src/templates/magazine-quote-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  quote: z.string().default('This agreement represents the most significant diplomatic breakthrough of the century.'),
  author: z.string().default('Dr. Elena Vasquez'),
  role: z.string().optional().default('Chief Diplomatic Correspondent'),
  context: z.string().optional(),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineQuoteDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineQuoteDepthProps = schema.parse({});
```

- [ ] **7.2** Create `packages/templates/src/templates/magazine-quote-depth/index.tsx`

The quote text renders oversized across the entire canvas. The speaker's body occludes parts of the text, creating the dramatic editorial "words behind the person" effect.

```tsx
// packages/templates/src/templates/magazine-quote-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineQuoteDepthProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const MagazineQuoteDepth: React.FC<MagazineQuoteDepthProps> = ({
  quote,
  author,
  role,
  context,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Staggered reveals
  const quoteMarkReveal = editorialReveal(frame, 5, 15);
  const quoteTextReveal = editorialReveal(frame, 12, 20);
  const ruleProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const authorReveal = editorialReveal(frame, 50, 15);
  const roleReveal = editorialReveal(frame, 58, 12);
  const contextReveal = editorialReveal(frame, 68, 15);

  // Subtle breathing drift behind speaker
  const breathX = Math.sin(frame * 0.015) * 4;
  const breathY = Math.sin(frame * 0.02 + 1) * 3;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute', inset: 0,
        transform: `translate(${breathX}px, ${breathY}px)`,
      }}>
        {/* Giant opening quotation mark — behind speaker center */}
        <div style={{
          position: 'absolute',
          left: centerPx.x - 160,
          top: bboxPx.y + bboxPx.h * 0.1,
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: 400,
          fontWeight: 700,
          color: MAGAZINE_COLORS.accent,
          opacity: quoteMarkReveal.opacity * 0.08,
          transform: `translateY(${quoteMarkReveal.translateY}px)`,
          lineHeight: 0.6,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {'\u201C'}
        </div>

        {/* Quote text — fills canvas, speaker body occludes middle */}
        <div style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: bboxPx.y + bboxPx.h * 0.15,
          opacity: quoteTextReveal.opacity,
          transform: `translateY(${quoteTextReveal.translateY}px)`,
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: 72,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}>
            {quote}
          </div>
        </div>

        {/* Accent rule — below speaker area */}
        <div style={{
          position: 'absolute',
          left: 60,
          top: bboxPx.y + bboxPx.h + 40,
          width: `${ruleProgress * 30}%`,
          height: 4,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 2,
        }} />

        {/* Author — in bottom visible zone */}
        <div style={{
          position: 'absolute',
          left: 60,
          top: bboxPx.y + bboxPx.h + 60,
          opacity: authorReveal.opacity,
          transform: `translateY(${authorReveal.translateY}px)`,
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: FONT_SIZES.h3,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
          }}>
            {'\u2014 '}{author}
          </div>
        </div>

        {/* Role */}
        {role && (
          <div style={{
            position: 'absolute',
            left: 86,
            top: bboxPx.y + bboxPx.h + 104,
            opacity: roleReveal.opacity,
            transform: `translateY(${roleReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body,
              fontSize: FONT_SIZES.large,
              fontStyle: 'italic',
              color: MAGAZINE_COLORS.secondary,
            }}>
              {role}
            </div>
          </div>
        )}

        {/* Context */}
        {context && (
          <div style={{
            position: 'absolute',
            left: 60,
            top: bboxPx.y + bboxPx.h + 140,
            opacity: contextReveal.opacity,
            transform: `translateY(${contextReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.accent,
              fontSize: FONT_SIZES.small,
              color: MAGAZINE_COLORS.secondary,
              letterSpacing: '0.05em',
            }}>
              {context}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default MagazineQuoteDepth;
```

- [ ] **7.3** Create `meta.json`, `metadata.json`, `register.ts` for magazine-quote-depth

Follow the same pattern as Tasks 5.3–5.5. The `register.ts` includes own files + `../../magazine/*` shared files + `../../depth/*` shared files. No base template component dependencies needed (self-contained).

- [ ] **7.4** Add registry import and registry.json entry

---

## Task 8: Magazine depth template — magazine-comparison-depth

Left subject appears behind speaker's left side, right subject behind the right. Speaker stands between the two options being compared.

- [ ] **8.1** Create `packages/templates/src/templates/magazine-comparison-depth/schema.ts`

```tsx
// packages/templates/src/templates/magazine-comparison-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  leftLabel: z.string().default('NATO'),
  rightLabel: z.string().default('BRICS'),
  items: z.array(z.object({
    category: z.string(),
    left: z.string(),
    right: z.string(),
  })).min(2).max(5).default([
    { category: 'Members', left: '32 nations', right: '10 nations' },
    { category: 'GDP Share', left: '~45% of world', right: '~35% of world' },
    { category: 'Military', left: '3.5M active', right: '5.2M active' },
  ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineComparisonDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineComparisonDepthProps = schema.parse({});
```

- [ ] **8.2** Create `packages/templates/src/templates/magazine-comparison-depth/index.tsx`

Positions left comparison card to peek from behind speaker's left shoulder, right card from behind the right. The speaker becomes the natural divider between options. Header in top visible zone, center divider runs through speaker center.

```tsx
// packages/templates/src/templates/magazine-comparison-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineComparisonDepthProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SectionLabel } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { ComparisonHeader } from '../magazine-comparison/components/ComparisonHeader';
import { ComparisonRow } from '../magazine-comparison/components/ComparisonRow';
import { CenterDivider } from '../magazine-comparison/components/CenterDivider';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const HEADER_Y = 100;
const HEADER_W = 960;
const ROW_SPACING = 300;
const ROW_W = 460;
const LABEL_W = 200;
const ROW_STAGGER = 12;
const ENTER_DURATION = 25;

const MagazineComparisonDepth: React.FC<MagazineComparisonDepthProps> = ({
  leftLabel,
  rightLabel,
  items = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const headerSlide = paperSlide(frame, 0, 20, 'down');

  // Rows start below the header, centered vertically around speaker
  const firstRowY = Math.max(360, centerPx.y - (items.length * ROW_SPACING) / 2);
  const lastRowY = firstRowY + (items.length - 1) * ROW_SPACING;
  const dividerStartY = HEADER_Y + 160;
  const dividerEndY = lastRowY + 200;

  // Left cards peek from behind speaker's left side
  // Right cards peek from behind speaker's right side
  const leftBaseX = bboxPx.x - ROW_W * 0.55;
  const rightBaseX = bboxPx.x + bboxPx.w - ROW_W * 0.45;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Header — top visible zone */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - HEADER_W) / 2 + headerSlide.translateX,
        top: HEADER_Y + headerSlide.translateY,
        opacity: headerSlide.opacity,
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <ComparisonHeader leftLabel={leftLabel} rightLabel={rightLabel} />
          <TapeMark corner="top-right" seed={55} />
        </div>
      </div>

      {/* Center divider — runs through speaker center */}
      <CenterDivider startY={dividerStartY} endY={dividerEndY} />

      {/* Comparison rows — peek from behind speaker's shoulders */}
      {items.map((item, i) => {
        const enterStart = 15 + i * ROW_STAGGER;
        const leftSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'left');
        const rightSlide = paperSlide(frame, enterStart, ENTER_DURATION, 'right');
        const landFrame = enterStart + ENTER_DURATION;
        const labelReveal = editorialReveal(frame, landFrame, 12);

        const depth = i % 3;
        const depthMul = (depth + 1) * 5;
        const parallaxBase = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const leftParallaxX = -parallaxBase;
        const rightParallaxX = parallaxBase;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.4 : 0;

        const isEntering = frame < landFrame;
        const rowY = firstRowY + i * ROW_SPACING;

        let lx = leftBaseX + leftParallaxX;
        let ly = rowY + parallaxY;
        let lOpacity = 1;
        if (isEntering) { lx += leftSlide.translateX; ly += leftSlide.translateY; lOpacity = leftSlide.opacity; }

        let rx = rightBaseX + rightParallaxX;
        let ry = rowY + parallaxY;
        let rOpacity = 1;
        if (isEntering) { rx += rightSlide.translateX; ry += rightSlide.translateY; rOpacity = rightSlide.opacity; }

        return (
          <React.Fragment key={i}>
            {/* Category label — centered at speaker X */}
            <div style={{
              position: 'absolute',
              left: centerPx.x - LABEL_W / 2, top: rowY - 35,
              width: LABEL_W,
              opacity: labelReveal.opacity,
              transform: `translateY(${labelReveal.translateY}px)`,
              zIndex: 5,
            }}>
              <SectionLabel label={item.category} />
            </div>

            {/* Left card — peeks from behind left shoulder */}
            <div style={{ position: 'absolute', left: lx, top: ly, opacity: lOpacity, zIndex: depth }}>
              <ComparisonRow text={item.left} side="left" index={i} />
            </div>

            {/* Right card — peeks from behind right shoulder */}
            <div style={{ position: 'absolute', left: rx, top: ry, opacity: rOpacity, zIndex: depth }}>
              <ComparisonRow text={item.right} side="right" index={i} />
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineComparisonDepth;
```

- [ ] **8.3** Create `meta.json`, `metadata.json`, `register.ts`

**`packages/templates/src/templates/magazine-comparison-depth/meta.json`:**
```json
{
  "slug": "magazine-comparison-depth",
  "name": "Magazine Comparison (Depth)",
  "description": "Left and right comparison cards peek from behind the speaker's shoulders — speaker becomes the natural divider",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "comparison", "versus", "split", "depth"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

**`packages/templates/src/templates/magazine-comparison-depth/metadata.json`:**
```json
{
  "compositionId": "magazine-comparison-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/magazine-comparison-depth/register.ts`:** follows the same pattern as Task 5.5 — register with `registerTemplate`, `getFiles` includes own files + `../../magazine/*` shared files + `../../depth/*` shared files + `../magazine-comparison/components/ComparisonHeader.tsx`, `../magazine-comparison/components/ComparisonRow.tsx`, and `../magazine-comparison/components/CenterDivider.tsx` from the base template.

- [ ] **8.4** Add registry import and registry.json entry

Add `import './templates/magazine-comparison-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "magazine-comparison-depth",
  "type": "registry:component",
  "description": "Left and right comparison cards peek from behind the speaker's shoulders — speaker becomes the natural divider",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "comparison", "versus", "split", "depth"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 9: Magazine depth template — magazine-checklist-depth

Checklist items stack vertically behind the speaker. Items peek from behind the speaker's torso, ticking off as narrated.

- [ ] **9.1** Create `packages/templates/src/templates/magazine-checklist-depth/schema.ts`

```tsx
// packages/templates/src/templates/magazine-checklist-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  items: z.array(z.object({
    text: z.string(),
    checked: z.boolean().default(true),
  })).min(2).max(6).default([
    { text: 'Ceasefire agreement signed', checked: true },
    { text: 'Humanitarian corridor opened', checked: true },
    { text: 'Sanctions package approved', checked: true },
  ]),
  title: z.string().default('Key Developments'),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type MagazineChecklistDepthProps = z.infer<typeof schema>;
export const defaultProps: MagazineChecklistDepthProps = schema.parse({});
```

- [ ] **9.2** Create `packages/templates/src/templates/magazine-checklist-depth/index.tsx`

Items are centered behind the speaker's torso, wide enough that text peeks from both sides. The check animation triggers on each item. Speaker body occludes the center, creating a partial-reveal effect.

```tsx
// packages/templates/src/templates/magazine-checklist-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, random } from 'remotion';
import type { MagazineChecklistDepthProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark, PinMark } from '../../magazine/decorations';
import { ChecklistItem } from '../magazine-checklist/components/ChecklistItem';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const TITLE_Y = 100;
const TITLE_W = 900;
const TITLE_H = 160;
const ITEM_W = 900;
const ITEM_SPACING = 180;
const STAGGER = 10;
const ENTER_DURATION = 25;

const DIRECTIONS: Array<'left' | 'right'> = ['left', 'right'];
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right', 'top-left', 'bottom-right', 'bottom-left',
];

const MagazineChecklistDepth: React.FC<MagazineChecklistDepthProps> = ({
  items = [],
  title,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Title in top visible zone
  const titleSlide = paperSlide(frame, 0, 20, 'down');

  // Items centered on speaker X, starting at chest height
  // Items are wider than the speaker so text peeks from both sides
  const itemStartY = Math.max(360, bboxPx.y + bboxPx.h * 0.25);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Title scrap — top visible zone */}
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={99} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="depth-checklist-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-right" seed={99} />
        </div>
      </div>

      {/* Checklist items — centered behind speaker's torso */}
      {items.map((item, i) => {
        const enterStart = 15 + i * STAGGER;
        const slide = paperSlide(frame, enterStart, ENTER_DURATION, DIRECTIONS[i % 2]);
        const landFrame = enterStart + ENTER_DURATION;
        const checkFrame = landFrame + 15;

        const depth = i % 3;
        const depthMul = (depth + 1) * 6;
        const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
        const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.5 : 0;

        const isEntering = frame < landFrame;

        // Center items on speaker X — wide enough to peek from both sides
        const baseX = centerPx.x - ITEM_W / 2 + (random(`check-depth-ox-${i}`) - 0.5) * 40;
        const baseY = itemStartY + i * ITEM_SPACING;

        let x = baseX + parallaxX;
        let y = baseY + parallaxY;
        let opacity = 1;

        if (isEntering) { x += slide.translateX; y += slide.translateY; opacity = slide.opacity; }

        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, opacity, zIndex: depth }}>
            <div style={{ position: 'relative' }}>
              <ChecklistItem text={item.text} checked={item.checked ?? true} index={i} appearFrame={enterStart} checkFrame={checkFrame} />
              {random(`check-depth-deco-${i}`) > 0.5 ? (
                <TapeMark corner={TAPE_CORNERS[i % 4]} seed={i + 30} />
              ) : (
                <PinMark x={ITEM_W / 2} y={4} seed={i + 30} />
              )}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineChecklistDepth;
```

- [ ] **9.3** Create `meta.json`, `metadata.json`, `register.ts`

**`packages/templates/src/templates/magazine-checklist-depth/meta.json`:**
```json
{
  "slug": "magazine-checklist-depth",
  "name": "Magazine Checklist (Depth)",
  "description": "Checklist items stack behind the speaker's torso — text peeks from both sides as items tick off",
  "category": "overlay",
  "tags": ["magazine-theme", "overlay", "checklist", "tasks", "progress", "depth"],
  "stylePreset": "elegantEditorial",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["magazine"]
}
```

**`packages/templates/src/templates/magazine-checklist-depth/metadata.json`:**
```json
{
  "compositionId": "magazine-checklist-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/magazine-checklist-depth/register.ts`:** follows the same pattern as Task 5.5 — register with `registerTemplate`, `getFiles` includes own files + `../../magazine/*` shared files + `../../depth/*` shared files + `../magazine-checklist/components/ChecklistItem.tsx` from the base template.

- [ ] **9.4** Add registry import and registry.json entry

Add `import './templates/magazine-checklist-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "magazine-checklist-depth",
  "type": "registry:component",
  "description": "Checklist items stack behind the speaker's torso — text peeks from both sides as items tick off",
  "categories": ["overlay"],
  "tags": ["magazine-theme", "overlay", "checklist", "tasks", "progress", "depth"],
  "meta": {
    "stylePreset": "elegantEditorial",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 10: Explainer depth template — explainer-process-depth

Process steps emerge from behind the speaker one-by-one, flowing from speaker center outward. Glow effects radiate from behind the silhouette.

- [ ] **10.1** Create `packages/templates/src/templates/explainer-process-depth/schema.ts`

Same as base `explainer-process` schema plus `speakerBbox` and `speakerCenter` fields. `showBackground` defaults to `false` (depth templates never render their own background — the source video is the background).

```tsx
// packages/templates/src/templates/explainer-process-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('How Data Travels'),
  steps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(6)
    .default([
      { label: 'Request', description: 'Browser sends HTTP request' },
      { label: 'Server', description: 'Server processes the query' },
      { label: 'Database', description: 'Data is retrieved from storage' },
      { label: 'Response', description: 'Results sent back to browser' },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerProcessDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerProcessDepthProps = schema.parse({});
```

- [ ] **10.2** Create `packages/templates/src/templates/explainer-process-depth/index.tsx`

Steps emerge from behind the speaker center using `DepthEntrance`. Each step node appears at staggered intervals. The connecting line runs through the speaker's center mass. Steps positioned to alternate left/right of speaker for maximum peek-from-behind effect.

```tsx
// packages/templates/src/templates/explainer-process-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerProcessDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn, drawLine } from '../../blackboard/animations';
import { GlowCircle } from '../../blackboard/effects';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerProcessDepth: React.FC<ExplainerProcessDepthProps> = ({
  title,
  steps = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Title in top visible zone
  const titleAnim = glowFadeIn(frame, 5);
  const lineAnim = drawLine(frame, 15, 30);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const circleSize = s(56);
  const stepGap = s(24);
  const stepBlockHeight = circleSize + stepGap;

  // Steps fan out from speaker center, alternating left and right
  const stepStartY = centerPx.y - ((steps.length - 1) * stepBlockHeight) / 2;

  const totalLineLength = (steps.length - 1) * stepBlockHeight;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        <div style={{
          position: 'absolute',
          top: s(120),
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: titleAnim.contentProgress,
          transform: `scale(${titleAnim.scale})`,
        }}>
          <GlowHeading text={title} size={s(52)} glowIntensity={titleAnim.glowProgress} />
        </div>

        {/* Connecting line through speaker center */}
        {steps.length > 1 && (
          <svg
            width={s(4)}
            height={totalLineLength}
            style={{
              position: 'absolute',
              left: centerPx.x - s(2),
              top: stepStartY + circleSize / 2,
              overflow: 'visible',
            }}
          >
            <line
              x1={s(2)} y1={0} x2={s(2)} y2={totalLineLength}
              stroke={BLACKBOARD_COLORS.primary}
              strokeWidth={s(3)}
              strokeDasharray={totalLineLength}
              strokeDashoffset={totalLineLength * (1 - lineAnim.progress)}
              strokeLinecap="round"
              opacity={0.8}
            />
          </svg>
        )}

        {/* Step nodes — alternate left/right of speaker */}
        {steps.map((step, i) => {
          const stepAnim = staggeredGlowIn(frame, 30, i, 10);
          const isLeft = i % 2 === 0;
          const nodeY = stepStartY + i * stepBlockHeight;

          // Position: circle at speaker center X, text extends outward
          const textX = isLeft
            ? centerPx.x - circleSize - s(16) - s(400)
            : centerPx.x + circleSize + s(16);

          return (
            <React.Fragment key={i}>
              {/* Numbered circle — centered on speaker X */}
              <div style={{
                position: 'absolute',
                left: centerPx.x - circleSize / 2,
                top: nodeY,
                opacity: stepAnim.contentProgress,
                transform: `scale(${stepAnim.scale})`,
              }}>
                <GlowCircle size={circleSize} glowIntensity={stepAnim.glowProgress} glowColor="primary">
                  <span style={{
                    fontFamily: BLACKBOARD_FONTS.mono,
                    fontSize: s(24),
                    fontWeight: 700,
                    color: BLACKBOARD_COLORS.primary,
                  }}>
                    {i + 1}
                  </span>
                </GlowCircle>
              </div>

              {/* Label + description — peek from behind shoulders */}
              <div style={{
                position: 'absolute',
                left: textX,
                top: nodeY,
                width: s(400),
                opacity: stepAnim.contentProgress,
                transform: `scale(${stepAnim.scale})`,
              }}>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: s(26),
                  fontWeight: 700,
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.2,
                  textAlign: isLeft ? 'right' : 'left',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(20),
                  color: BLACKBOARD_COLORS.textMuted,
                  lineHeight: 1.3,
                  marginTop: s(4),
                  textAlign: isLeft ? 'right' : 'left',
                }}>
                  {step.description}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerProcessDepth;
```

- [ ] **10.3** Create `meta.json`, `metadata.json`, `register.ts`

**`meta.json`:**
```json
{
  "slug": "explainer-process-depth",
  "name": "Explainer Process (Depth)",
  "description": "Process steps emerge from behind the speaker, flowing outward from center with glowing connecting line",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "process", "steps", "depth"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

Register includes `../../blackboard/*` and `../../depth/*` shared files.

- [ ] **10.4** Add registry import and registry.json entry

---

## Task 11: Explainer depth template — explainer-layers-depth

System layers stack behind the speaker — back layers smaller/dimmer, front layers larger/brighter. Speaker stands "in front of the architecture."

- [ ] **11.1** Create `packages/templates/src/templates/explainer-layers-depth/schema.ts`

```tsx
// packages/templates/src/templates/explainer-layers-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('Web Application Stack'),
  layers: z
    .array(
      z.object({
        label: z.string(),
        items: z.array(z.string()).max(5).optional(),
      }),
    )
    .min(3)
    .max(7)
    .default([
      { label: 'Infrastructure', items: ['AWS', 'Docker', 'K8s'] },
      { label: 'Database', items: ['PostgreSQL', 'Redis'] },
      { label: 'Backend', items: ['Node.js', 'Express', 'GraphQL'] },
      { label: 'Frontend', items: ['React', 'TypeScript', 'Tailwind'] },
      { label: 'CDN & Edge', items: ['CloudFront', 'Vercel'] },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerLayersDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerLayersDepthProps = schema.parse({});
```

- [ ] **11.2** Create `packages/templates/src/templates/explainer-layers-depth/index.tsx`

Layer cards are wider than the speaker, positioned at speaker center with progressive Y offsets. Each layer is sized so edges peek from behind the speaker's silhouette. Bottom layers are smaller (farther), top layers are wider (closer). Uses parallax for differential drift.

```tsx
// packages/templates/src/templates/explainer-layers-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerLayersDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerLayersDepth: React.FC<ExplainerLayersDepthProps> = ({
  title,
  layers = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Title in top visible zone
  const titleAnim = glowFadeIn(frame, 0, 10);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const layerCount = layers.length;
  const layerH = s(130);
  const layerGap = s(12);
  const layerRadius = s(12);
  const accentW = s(4);
  const badgeRadius = s(8);
  const badgePadH = s(14);
  const badgePadV = s(6);
  const badgeGap = s(8);
  const badgeFontSize = s(16);
  const labelFontSize = s(26);

  // Stack anchor: layers centered vertically around speaker center
  // Bottom layer (index 0) at bottom, top layer (index N-1) at top
  const stackBottomY = centerPx.y + ((layerCount - 1) * (layerH + layerGap)) / 2;

  // Layer widths grow from bottom (farther) to top (closer)
  // Bottom layers are narrower (behind speaker), top layers are wider (peek more)
  const minLayerW = s(700);
  const maxLayerW = s(900);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        <div style={{
          position: 'absolute',
          top: s(120),
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: titleAnim.contentProgress,
          transform: `scale(${titleAnim.scale})`,
        }}>
          <GlowHeading text={title ?? ''} size={s(52)} glowIntensity={titleAnim.glowProgress} />
        </div>

        {/* Layers — stacked behind speaker, widening toward viewer */}
        {layers.map((layer, i) => {
          const enterStart = 8 + i * 8;
          const enterDuration = 18;

          const slideY = interpolate(
            frame,
            [enterStart, enterStart + enterDuration],
            [s(100), 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2)) },
          );

          const layerOpacity = interpolate(
            frame,
            [enterStart, enterStart + enterDuration * 0.5],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Width grows from bottom to top (perspective depth)
          const widthProgress = layerCount > 1 ? i / (layerCount - 1) : 0.5;
          const layerW = minLayerW + (maxLayerW - minLayerW) * widthProgress;

          // Dimming: bottom layers dimmer, top layers brighter
          const brightnessMultiplier = 0.6 + widthProgress * 0.4;

          // Y position: bottom-up stacking centered on speaker
          const fromBottom = i;
          const layerY = stackBottomY - fromBottom * (layerH + layerGap);

          // Center horizontally on speaker
          const layerX = centerPx.x - layerW / 2;

          // Parallax: deeper layers drift less
          const depthTier = layerCount - 1 - i; // 0 = top/closest, N-1 = bottom/farthest
          const depthMul = Math.max(2, (depthTier + 1) * 4);
          const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
          const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6 : 0;

          const accentColor = i % 2 === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;

          // Sub-item badge fade-in
          const badgesStart = 55 + i * 4;
          const badgesOpacity = interpolate(
            frame,
            [badgesStart, badgesStart + 12],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: layerX + parallaxX,
                top: layerY + parallaxY,
                width: layerW,
                height: layerH,
                opacity: layerOpacity * brightnessMultiplier,
                transform: `translateY(${slideY}px)`,
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `1px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
                borderRadius: layerRadius,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: i,
              }}
            >
              {/* Left accent strip */}
              <div style={{
                width: accentW,
                height: '100%',
                backgroundColor: accentColor,
                flexShrink: 0,
                borderRadius: `${layerRadius}px 0 0 ${layerRadius}px`,
              }} />

              {/* Content area */}
              <div style={{
                flex: 1,
                padding: `0 ${s(24)}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: s(8),
              }}>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: labelFontSize,
                  fontWeight: 600,
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}>
                  {layer.label}
                </div>

                {layer.items && layer.items.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: badgeGap,
                    opacity: badgesOpacity,
                  }}>
                    {layer.items.map((item, j) => (
                      <div key={j} style={{
                        backgroundColor: BLACKBOARD_COLORS.surfaceBorder,
                        borderRadius: badgeRadius,
                        padding: `${badgePadV}px ${badgePadH}px`,
                        fontFamily: BLACKBOARD_FONTS.mono,
                        fontSize: badgeFontSize,
                        fontWeight: 500,
                        color: BLACKBOARD_COLORS.textMuted,
                        lineHeight: 1,
                      }}>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerLayersDepth;
```

- [ ] **11.3** Create `meta.json`, `metadata.json`, `register.ts`

**`packages/templates/src/templates/explainer-layers-depth/meta.json`:**
```json
{
  "slug": "explainer-layers-depth",
  "name": "Explainer Layers (Depth)",
  "description": "System layers stack behind the speaker — back layers smaller and dimmer, front layers larger and brighter",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "layers", "stack", "architecture", "depth"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

**`packages/templates/src/templates/explainer-layers-depth/metadata.json`:**
```json
{
  "compositionId": "explainer-layers-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/explainer-layers-depth/register.ts`:** follows the same pattern as Task 10.3 — register with `registerTemplate`, `getFiles` includes own files + `../../blackboard/*` shared files + `../../depth/*` shared files.

- [ ] **11.4** Add registry import and registry.json entry

Add `import './templates/explainer-layers-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "explainer-layers-depth",
  "type": "registry:component",
  "description": "System layers stack behind the speaker — back layers smaller and dimmer, front layers larger and brighter",
  "categories": ["overlay"],
  "tags": ["blackboard-theme", "overlay", "explainer", "layers", "stack", "architecture", "depth"],
  "meta": {
    "stylePreset": "cleanMinimal",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 12: Explainer depth template — explainer-stats-depth

Large count-up numbers scale up from behind the speaker's center mass. Numbers grow large enough to peek past the speaker's shoulders.

- [ ] **12.1** Create `packages/templates/src/templates/explainer-stats-depth/schema.ts`

```tsx
// packages/templates/src/templates/explainer-stats-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  title: z.string().default('The Internet in Numbers'),
  stats: z
    .array(
      z.object({
        value: z.number().min(0),
        label: z.string(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
      }),
    )
    .min(2)
    .max(4)
    .default([
      { value: 5.3, label: 'Billion Users', suffix: 'B' },
      { value: 1.13, label: 'Billion Websites', suffix: 'B' },
      { value: 333, label: 'Million Terabytes Daily', suffix: 'M' },
    ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerStatsDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerStatsDepthProps = schema.parse({});
```

- [ ] **12.2** Create `packages/templates/src/templates/explainer-stats-depth/index.tsx`

Each stat number starts at the speaker center with `DepthEntrance`, scaling up to a size where digits extend past both edges of the speaker bbox. Labels sit in the visible bottom zone. The speaker's body partially occludes the large numbers, creating the "massive stat" depth effect.

```tsx
// packages/templates/src/templates/explainer-stats-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerStatsDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, staggeredGlowIn, glowExit } from '../../blackboard/animations';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { CountUp } from '../explainer-stats/components/CountUp';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerStatsDepth: React.FC<ExplainerStatsDepthProps> = ({
  title,
  stats = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const count = stats.length;

  // Stats are shown sequentially — each occupies its time window
  // then holds. All numbers are oversized and centered on speaker.
  const statStagger = 12;
  const statEnterDuration = 20;

  // Oversized number font — large enough to extend past speaker bbox
  const bigFontSize = s(140);

  // Layout: numbers stacked vertically around speaker center
  const statSpacing = s(280);
  const firstStatY = centerPx.y - ((count - 1) * statSpacing) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        {title && (
          <div style={{
            position: 'absolute',
            top: s(120),
            left: 0,
            width: '100%',
            textAlign: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}>
            <GlowHeading text={title} size={s(48)} glowIntensity={titleAnim.glowProgress} />
          </div>
        )}

        {/* Stat numbers — oversized, centered on speaker */}
        {stats.map((stat, index) => {
          const enterStart = 20 + index * statStagger;
          const stagger = staggeredGlowIn(frame, enterStart, index, statStagger);
          const countStart = enterStart + 5;
          const pulseStart = enterStart + 35;

          // DepthEntrance: scale from 0.3 at speaker center to full size
          const entranceProgress = interpolate(
            frame,
            [enterStart, enterStart + statEnterDuration],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1)) },
          );
          const entranceScale = interpolate(entranceProgress, [0, 1], [0.3, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const entranceOpacity = interpolate(entranceProgress, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });

          // Subtle drift after landing
          const depthMul = (index + 1) * 6;
          const driftX = frame >= enterStart + statEnterDuration
            ? Math.sin(frame * 0.015 + index * 2.0) * depthMul : 0;
          const driftY = frame >= enterStart + statEnterDuration
            ? Math.sin(frame * 0.02 + index * 1.5) * depthMul * 0.5 : 0;

          const statY = firstStatY + index * statSpacing;

          return (
            <React.Fragment key={index}>
              {/* Oversized number — centered on speaker, extends past bbox */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: statY - bigFontSize / 2,
                display: 'flex',
                justifyContent: 'center',
                opacity: entranceOpacity,
                transform: `scale(${entranceScale}) translate(${driftX}px, ${driftY}px)`,
                transformOrigin: `${centerPx.x}px ${bigFontSize / 2}px`,
                zIndex: index,
              }}>
                <CountUp
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  startFrame={countStart}
                  duration={30}
                  fontSize={bigFontSize}
                  pulseStart={pulseStart}
                />
              </div>

              {/* Label — in visible zone below speaker */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: statY + bigFontSize * 0.4,
                textAlign: 'center',
                opacity: stagger.contentProgress,
                transform: `scale(${stagger.scale})`,
                zIndex: count + index,
              }}>
                <GlowLabel
                  text={stat.label}
                  size={s(22)}
                  color={BLACKBOARD_COLORS.textMuted}
                />
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerStatsDepth;
```

- [ ] **12.3** Create `meta.json`, `metadata.json`, `register.ts`

**`packages/templates/src/templates/explainer-stats-depth/meta.json`:**
```json
{
  "slug": "explainer-stats-depth",
  "name": "Explainer Stats (Depth)",
  "description": "Oversized count-up numbers scale up from behind the speaker's center — digits extend past shoulders for dramatic depth",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "stats", "numbers", "data", "depth"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

**`packages/templates/src/templates/explainer-stats-depth/metadata.json`:**
```json
{
  "compositionId": "explainer-stats-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/explainer-stats-depth/register.ts`:** follows the same pattern as Task 10.3 — register with `registerTemplate`, `getFiles` includes own files + `../../blackboard/*` shared files + `../../depth/*` shared files + `../explainer-stats/components/CountUp.tsx` from the base template.

- [ ] **12.4** Add registry import and registry.json entry

Add `import './templates/explainer-stats-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "explainer-stats-depth",
  "type": "registry:component",
  "description": "Oversized count-up numbers scale up from behind the speaker's center — digits extend past shoulders for dramatic depth",
  "categories": ["overlay"],
  "tags": ["blackboard-theme", "overlay", "explainer", "stats", "numbers", "data", "depth"],
  "meta": {
    "stylePreset": "cleanMinimal",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 13: Explainer depth template — explainer-comparison-depth

Two comparison sides split behind the speaker. Left column behind left shoulder, right column behind right shoulder. Speaker is the neutral center.

- [ ] **13.1** Create `packages/templates/src/templates/explainer-comparison-depth/schema.ts`

```tsx
// packages/templates/src/templates/explainer-comparison-depth/schema.ts
import { z } from 'zod';

const speakerBboxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

export const schema = z.object({
  heading: z.string().default('Cloud vs On-Premise'),
  titleA: z.string().default('Cloud'),
  titleB: z.string().default('On-Premise'),
  pointsA: z.array(z.string()).min(2).max(5).default([
    'Scales instantly',
    'Pay per use',
    'Managed updates',
  ]),
  pointsB: z.array(z.string()).min(2).max(5).default([
    'Full control',
    'One-time cost',
    'Data stays local',
  ]),
  speakerBbox: speakerBboxSchema.default({ x: 0.28, y: 0.10, w: 0.44, h: 0.75 }),
  speakerCenter: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0.50, y: 0.45 }),
});

export type ExplainerComparisonDepthProps = z.infer<typeof schema>;
export const defaultProps: ExplainerComparisonDepthProps = schema.parse({});
```

- [ ] **13.2** Create `packages/templates/src/templates/explainer-comparison-depth/index.tsx`

Left `GlowPanel` positioned behind speaker's left side (overlapping bboxPx left edge), right `GlowPanel` behind speaker's right side. Heading in top visible zone. Speaker stands between the two options. Point bullets peek from behind the speaker's arms.

```tsx
// packages/templates/src/templates/explainer-comparison-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerComparisonDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { GlowHeading } from '../../blackboard/typography';
import { GlowPanel } from '../../blackboard/effects';
import { useScale } from '../../use-scale';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerComparisonDepth: React.FC<ExplainerComparisonDepthProps> = ({
  heading,
  titleA,
  titleB,
  pointsA = [],
  pointsB = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const headingAnim = glowFadeIn(frame, 5);
  const headerAnim = glowFadeIn(frame, 20);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  // Panel width: wide enough to extend from edge of canvas to behind speaker's shoulder
  const panelW = s(460);
  const panelGap = s(16);

  // Left panel: right edge overlaps into speaker bbox (peeks from left shoulder)
  const leftPanelX = bboxPx.x - panelW * 0.55;
  // Right panel: left edge overlaps into speaker bbox (peeks from right shoulder)
  const rightPanelX = bboxPx.x + bboxPx.w - panelW * 0.45;

  // Panels centered vertically at speaker chest height
  const panelTopY = bboxPx.y + bboxPx.h * 0.15;

  // Subtle parallax for spatial separation
  const leftDriftX = frame >= 60 ? Math.sin(frame * 0.02) * 6 : 0;
  const rightDriftX = frame >= 60 ? Math.sin(frame * 0.02 + Math.PI) * 6 : 0;
  const driftY = frame >= 60 ? Math.sin(frame * 0.025) * 4 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Heading — top visible zone */}
        {heading && (
          <div style={{
            position: 'absolute',
            top: s(120),
            left: 0,
            width: '100%',
            textAlign: 'center',
            opacity: headingAnim.contentProgress,
            transform: `scale(${headingAnim.scale})`,
            zIndex: 10,
          }}>
            <GlowHeading text={heading} size={s(44)} glowIntensity={headingAnim.glowProgress} />
          </div>
        )}

        {/* Left column — behind speaker's left side (primary/amber) */}
        <div style={{
          position: 'absolute',
          left: leftPanelX + leftDriftX,
          top: panelTopY + driftY,
          width: panelW,
          zIndex: 0,
        }}>
          <GlowPanel
            glowColor="primary"
            glowIntensity={headerAnim.glowProgress}
            style={{
              padding: s(24),
              opacity: headerAnim.contentProgress,
              transform: `scale(${headerAnim.scale})`,
            }}
          >
            <div style={{ marginBottom: s(20) }}>
              <GlowHeading
                text={titleA}
                size={s(32)}
                color={BLACKBOARD_COLORS.primary}
                glowIntensity={headerAnim.glowProgress}
              />
            </div>

            {pointsA.map((point, index) => {
              const anim = staggeredGlowIn(frame, 35, index, 6);
              return (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: s(12),
                  marginBottom: s(14),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}>
                  <div style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.primary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }} />
                  <div style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(22),
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.4,
                  }}>
                    {point}
                  </div>
                </div>
              );
            })}
          </GlowPanel>
        </div>

        {/* Right column — behind speaker's right side (secondary/cyan) */}
        <div style={{
          position: 'absolute',
          left: rightPanelX + rightDriftX,
          top: panelTopY + driftY,
          width: panelW,
          zIndex: 0,
        }}>
          <GlowPanel
            glowColor="secondary"
            glowIntensity={headerAnim.glowProgress}
            style={{
              padding: s(24),
              opacity: headerAnim.contentProgress,
              transform: `scale(${headerAnim.scale})`,
            }}
          >
            <div style={{ marginBottom: s(20) }}>
              <GlowHeading
                text={titleB}
                size={s(32)}
                color={BLACKBOARD_COLORS.secondary}
                glowIntensity={headerAnim.glowProgress}
              />
            </div>

            {pointsB.map((point, index) => {
              const anim = staggeredGlowIn(frame, 35, index, 6);
              return (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: s(12),
                  marginBottom: s(14),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}>
                  <div style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.secondary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }} />
                  <div style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(22),
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.4,
                  }}>
                    {point}
                  </div>
                </div>
              );
            })}
          </GlowPanel>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerComparisonDepth;
```

- [ ] **13.3** Create `meta.json`, `metadata.json`, `register.ts`

**`packages/templates/src/templates/explainer-comparison-depth/meta.json`:**
```json
{
  "slug": "explainer-comparison-depth",
  "name": "Explainer Comparison (Depth)",
  "description": "Two comparison columns split behind the speaker — left vs right panels peek from behind shoulders",
  "category": "overlay",
  "tags": ["blackboard-theme", "overlay", "explainer", "comparison", "versus", "depth"],
  "stylePreset": "cleanMinimal",
  "aspectRatio": "9:16",
  "sceneCount": 1,
  "estimatedDuration": "5s",
  "thumbnail": "thumbnail.png",
  "type": "overlay",
  "themes": ["blackboard"]
}
```

**`packages/templates/src/templates/explainer-comparison-depth/metadata.json`:**
```json
{
  "compositionId": "explainer-comparison-depth",
  "durationInFrames": 150,
  "fps": 30,
  "width": 1080,
  "height": 1920
}
```

**`packages/templates/src/templates/explainer-comparison-depth/register.ts`:** follows the same pattern as Task 10.3 — register with `registerTemplate`, `getFiles` includes own files + `../../blackboard/*` shared files + `../../depth/*` shared files.

- [ ] **13.4** Add registry import and registry.json entry

Add `import './templates/explainer-comparison-depth/register';` to `packages/templates/src/index.ts`.

Add entry to `packages/templates/registry.json` items array:

```json
{
  "name": "explainer-comparison-depth",
  "type": "registry:component",
  "description": "Two comparison columns split behind the speaker — left vs right panels peek from behind shoulders",
  "categories": ["overlay"],
  "tags": ["blackboard-theme", "overlay", "explainer", "comparison", "versus", "depth"],
  "meta": {
    "stylePreset": "cleanMinimal",
    "aspectRatio": "9:16",
    "estimatedDuration": "5s"
  }
}
```

---

## Task 14: Build verification and registry rebuild

- [ ] **14.1** Run TypeScript check across the templates package

```bash
cd packages/templates && npx tsc --noEmit --pretty
```

Fix any type errors in the new depth templates.

- [ ] **14.2** Run the registry build script

```bash
cd packages/templates && npx tsx scripts/build-registry.ts
```

Verify all 9 new depth templates appear in the generated registry.

- [ ] **14.3** Run TypeScript check on the sandbox template workspace

```bash
cd packages/sandbox/template && npx tsc --noEmit --pretty
```

Fix any type errors in `SandwichComposite`, `DepthLayers`, `PersonItem`, or `PlayerComposition` changes.

- [ ] **14.4** Commit: "feat: add Remotion depth compositing system"

Commit all new files:
- `packages/sandbox/template/src/composition/SandwichComposite.tsx`
- `packages/sandbox/template/src/composition/DepthLayers.tsx`
- `packages/sandbox/template/src/items/PersonItem.tsx`
- `packages/templates/src/depth/*` (types, utilities)
- All 9 depth template directories
- Updated `PlayerComposition.tsx`, items index, templates index, registry.json

---

## Summary

| # | Task | Files | Est. |
|---|------|-------|------|
| 1 | SandwichComposite | `composition/SandwichComposite.tsx` | 4 min |
| 2 | BehindSpeaker / InFrontOfSpeaker | `composition/DepthLayers.tsx` | 3 min |
| 3 | PlayerComposition integration | `PlayerComposition.tsx`, `items/PersonItem.tsx` | 5 min |
| 4 | Shared depth utilities | `depth/types.ts`, `depth/SpeakerAwareLayout.tsx`, `depth/DepthEntrance.tsx`, `depth/DepthParallax.tsx` | 5 min |
| 5 | magazine-stats-depth | `templates/magazine-stats-depth/*` | 5 min |
| 6 | magazine-timeline-depth | `templates/magazine-timeline-depth/*` | 5 min |
| 7 | magazine-quote-depth | `templates/magazine-quote-depth/*` | 4 min |
| 8 | magazine-comparison-depth | `templates/magazine-comparison-depth/*` | 4 min |
| 9 | magazine-checklist-depth | `templates/magazine-checklist-depth/*` | 4 min |
| 10 | explainer-process-depth | `templates/explainer-process-depth/*` | 5 min |
| 11 | explainer-layers-depth | `templates/explainer-layers-depth/*` | 4 min |
| 12 | explainer-stats-depth | `templates/explainer-stats-depth/*` | 4 min |
| 13 | explainer-comparison-depth | `templates/explainer-comparison-depth/*` | 4 min |
| 14 | Build verification | All | 3 min |
| **Total** | | | **~55 min** |
