# Scene Transitions — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seamless scene transitions (crossfade, slide, zoom, morph, fade) to FullComposition so adjacent visual items can blend smoothly instead of hard-cutting.

**Architecture:** FullComposition gains a new `sceneItems` prop describing visual items with transition config. A new `SceneTransitionLayer` component renders scenes in overlapping `<Sequence>` blocks with per-frame transition effects (opacity, transform, scale). When `sceneItems` is provided, FullComposition delegates scene rendering to SceneTransitionLayer instead of rendering raw `children` through VisualsLayer. `manifestToProps` is updated to extract transition data from manifest visual items into the new prop format. Backward compatible — `children` still works when `sceneItems` is absent.

**Tech Stack:** Remotion (`Sequence`, `useCurrentFrame`, `interpolate`), React, TypeScript

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/worker/remotion-template/src/composition/SceneTransitionLayer.tsx` | Renders scenes with overlapping sequences + transition effects |
| Create | `packages/worker/remotion-template/src/composition/transitions.ts` | Pure functions computing transition CSS (opacity, transform) per frame |
| Modify | `packages/worker/remotion-template/src/composition/types.ts` | Add `SceneItem`, `SceneTransition`, `TransitionType` types |
| Modify | `packages/worker/remotion-template/src/composition/FullComposition.tsx` | Accept `sceneItems` + `renderScene`, delegate to SceneTransitionLayer |
| Modify | `packages/worker/remotion-template/src/composition/index.ts` | Export new types and components |
| Modify | `packages/worker/src/processors/render/manifest-to-props.ts` | Extract visual item transitions into `sceneItems` prop |

---

## Chunk 1: Transition Types and Pure Functions

### Task 1: Add scene transition types

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/types.ts`

- [ ] **Step 1: Read the existing types file**

Read `packages/worker/remotion-template/src/composition/types.ts` to understand existing types.

- [ ] **Step 2: Add transition types at the end of the file**

Append these types after the existing `FullCompositionProps` interface:

```typescript
// ---- Scene transition types ----

export type TransitionType = 'cut' | 'crossfade' | 'slide-left' | 'slide-up' | 'zoom' | 'morph' | 'fade';

export interface SceneTransition {
  type: TransitionType;
  durationMs: number;
}

/**
 * Visual item metadata for scene transition rendering.
 * Each SceneItem maps to one visual item in the manifest.
 */
export interface SceneItem {
  id: string;
  startFrame: number;
  endFrame: number;
  sceneFile: string;
  displayMode: DisplayMode;
  frameOffset?: number;
  enter?: SceneTransition;
  exit?: SceneTransition;
}
```

- [ ] **Step 3: Add `sceneItems` and `renderScene` to FullCompositionProps**

Add two optional fields to the existing `FullCompositionProps` interface:

```typescript
export interface FullCompositionProps {
  // ... existing fields stay exactly as they are ...

  /** Visual items with transition config. When provided, FullComposition renders scenes
   *  via SceneTransitionLayer instead of using children through VisualsLayer. */
  sceneItems?: SceneItem[];
  /** Callback to render a scene by sceneFile path. Required when sceneItems is provided. */
  renderScene?: (sceneFile: string, frameOffset: number) => React.ReactNode;
}
```

Note: `renderScene` takes a `sceneFile` path (e.g. `"scenes/Scene1.tsx"`) and `frameOffset`, returns the scene React element. This decouples FullComposition from how scenes are loaded (workspace bundle, dynamic import, etc.). The manifest uses `sceneFile` (not `compositionId`) to identify scenes.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/remotion-template/src/composition/types.ts
git commit -m "feat(composition): add scene transition types to FullComposition"
```

---

### Task 2: Create transitions.ts — pure transition effect functions

**Files:**
- Create: `packages/worker/remotion-template/src/composition/transitions.ts`

These are pure functions that compute CSS styles for each transition type at a given progress value (0→1). No React, no hooks — just math.

- [ ] **Step 1: Write the transitions module**

```typescript
/**
 * Pure functions that compute CSS styles for scene transitions.
 * Each function takes a progress value (0→1) and returns CSSProperties.
 *
 * Enter transitions: progress 0→1 means entering (invisible → fully visible)
 * Exit transitions:  progress 0→1 means exiting (fully visible → invisible)
 */
import type { CSSProperties } from 'react';
import type { TransitionType } from './types';

/** Crossfade: simple opacity transition */
function crossfade(progress: number, isExit: boolean): CSSProperties {
  const opacity = isExit ? 1 - progress : progress;
  return { opacity };
}

/** Fade: same as crossfade (alias for clarity in transition picker) */
function fade(progress: number, isExit: boolean): CSSProperties {
  return crossfade(progress, isExit);
}

/** Slide left: outgoing slides left, incoming slides from right */
function slideLeft(progress: number, isExit: boolean): CSSProperties {
  const translateX = isExit ? -progress * 100 : (1 - progress) * 100;
  return {
    transform: `translateX(${translateX}%)`,
    opacity: 1,
  };
}

/** Slide up: outgoing slides up, incoming slides from bottom */
function slideUp(progress: number, isExit: boolean): CSSProperties {
  const translateY = isExit ? -progress * 100 : (1 - progress) * 100;
  return {
    transform: `translateY(${translateY}%)`,
    opacity: 1,
  };
}

/** Zoom: outgoing scales down + fades, incoming scales up from small */
function zoom(progress: number, isExit: boolean): CSSProperties {
  if (isExit) {
    const scale = 1 - progress * 0.3; // 1.0 → 0.7
    return {
      transform: `scale(${scale})`,
      opacity: 1 - progress,
    };
  }
  const scale = 0.7 + progress * 0.3; // 0.7 → 1.0
  return {
    transform: `scale(${scale})`,
    opacity: progress,
  };
}

/** Morph: outgoing shrinks to center, incoming expands from center */
function morph(progress: number, isExit: boolean): CSSProperties {
  if (isExit) {
    const scale = 1 - progress * 0.5; // 1.0 → 0.5
    return {
      transform: `scale(${scale})`,
      opacity: 1 - progress,
    };
  }
  const scale = 0.5 + progress * 0.5; // 0.5 → 1.0
  return {
    transform: `scale(${scale})`,
    opacity: progress,
  };
}

/** Cut: instant switch, no animation */
function cut(_progress: number, _isExit: boolean): CSSProperties {
  return {};
}

const TRANSITION_FNS: Record<TransitionType, (progress: number, isExit: boolean) => CSSProperties> = {
  cut,
  crossfade,
  fade,
  'slide-left': slideLeft,
  'slide-up': slideUp,
  zoom,
  morph,
};

/**
 * Compute the CSS style for a scene at a given transition progress.
 * @param type - The transition type
 * @param progress - 0→1 progress through the transition
 * @param isExit - true if this is the exiting scene, false if entering
 */
export function computeTransitionStyle(
  type: TransitionType,
  progress: number,
  isExit: boolean,
): CSSProperties {
  const fn = TRANSITION_FNS[type] || cut;
  return fn(progress, isExit);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/transitions.ts
git commit -m "feat(composition): add pure transition effect functions"
```

---

## Chunk 2: SceneTransitionLayer Component

### Task 3: Create SceneTransitionLayer.tsx

**Files:**
- Create: `packages/worker/remotion-template/src/composition/SceneTransitionLayer.tsx`

This component renders scenes in overlapping `<Sequence>` blocks with transition effects. Adjacent scenes with transition config render during an overlap window where both are visible.

Per the spec:
- The overlap is centered on the boundary — each side extends by half the transition duration
- Scene1's `endMs` and Scene2's `startMs` remain the content boundaries
- SceneTransitionLayer computes the extensions internally
- The transition duration is `max(scene1.exit.durationMs, scene2.enter.durationMs)`

- [ ] **Step 1: Read spec section on transitions**

From the spec (lines 292-328):
```
Scene1 content endMs:   8000ms (frame 240)
Scene2 content startMs: 8000ms (frame 240)

Overlap window: 7700ms - 8300ms (frames 231 - 249)

Scene1 effective render: frame 0 → frame 249 (extended 9 frames past content end)
Scene2 effective render: frame 231 → frame 450+ (started 9 frames before content start)

During overlap (frames 231-249):
  Scene1 opacity: interpolate(frame, [231, 249], [1, 0], { extrapolateLeft/Right: 'clamp' })
  Scene2 opacity: interpolate(frame, [231, 249], [0, 1], { extrapolateLeft/Right: 'clamp' })
```

- [ ] **Step 2: Write the SceneTransitionLayer component**

```tsx
/**
 * Renders visual scenes with overlapping Sequences for smooth transitions.
 *
 * When two adjacent scenes have transition config, their render windows
 * overlap by the transition duration. During the overlap, both scenes
 * render with transition effects (opacity, transform, etc.).
 */
import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { SceneItem, Rect } from './types';
import { computeTransitionStyle } from './transitions';
import { VisualsLayer } from './VisualsLayer';

interface SceneTransitionLayerProps {
  sceneItems: SceneItem[];
  renderScene: (sceneFile: string, frameOffset: number) => React.ReactNode;
  rect: Rect;
  opacity: number;
}

/**
 * Compute the overlap duration in frames between two adjacent scenes.
 * The overlap is determined by the max of scene1's exit and scene2's enter duration.
 */
function computeOverlapFrames(
  exitScene: SceneItem | undefined,
  enterScene: SceneItem | undefined,
  fps: number,
): number {
  if (!exitScene?.exit && !enterScene?.enter) return 0;

  const exitMs = exitScene?.exit?.durationMs ?? 0;
  const enterMs = enterScene?.enter?.durationMs ?? 0;
  const overlapMs = Math.max(exitMs, enterMs);

  if (overlapMs === 0) return 0;
  return Math.round((overlapMs / 1000) * fps);
}

export const SceneTransitionLayer: React.FC<SceneTransitionLayerProps> = ({
  sceneItems,
  renderScene,
  rect,
  opacity,
}) => {
  const { fps } = useVideoConfig();

  if (sceneItems.length === 0) return null;

  // Sort scenes by startFrame
  const sorted = [...sceneItems].sort((a, b) => a.startFrame - b.startFrame);

  // Build render entries with extended windows for transitions
  const entries = sorted.map((scene, idx) => {
    const prevScene = idx > 0 ? sorted[idx - 1] : undefined;
    const nextScene = idx < sorted.length - 1 ? sorted[idx + 1] : undefined;

    // Overlap with previous scene (this scene is entering)
    // Use floor+ceil split so enterHalf + exitHalf on the other scene = total overlap
    const enterOverlapFrames = computeOverlapFrames(prevScene, scene, fps);
    const enterHalf = Math.floor(enterOverlapFrames / 2);

    // Overlap with next scene (this scene is exiting)
    const exitOverlapFrames = computeOverlapFrames(scene, nextScene, fps);
    const exitHalf = Math.ceil(exitOverlapFrames / 2);

    // Extended render window
    const effectiveStart = scene.startFrame - enterHalf;
    const effectiveEnd = scene.endFrame + exitHalf;

    return {
      scene,
      effectiveStart,
      effectiveEnd,
      // Enter transition info
      enterType: (scene.enter?.type ?? prevScene?.exit?.type ?? 'cut') as TransitionType,
      enterOverlapStart: scene.startFrame - enterHalf,
      enterOverlapEnd: scene.startFrame + enterHalf,
      hasEnterTransition: enterOverlapFrames > 0,
      // Exit transition info
      exitType: (scene.exit?.type ?? nextScene?.enter?.type ?? 'cut') as TransitionType,
      exitOverlapStart: scene.endFrame - exitHalf,
      exitOverlapEnd: scene.endFrame + exitHalf,
      hasExitTransition: exitOverlapFrames > 0,
    };
  });

  return (
    <VisualsLayer rect={rect} opacity={opacity}>
      {entries.map((entry) => {
        const { scene, effectiveStart, effectiveEnd } = entry;
        const durationFrames = effectiveEnd - effectiveStart;

        if (durationFrames <= 0) return null;

        return (
          <Sequence
            key={scene.id}
            from={effectiveStart}
            durationInFrames={durationFrames}
            layout="none"
          >
            <SceneWithTransitions entry={entry} renderScene={renderScene} />
          </Sequence>
        );
      })}
    </VisualsLayer>
  );
};

/**
 * Inner component that applies enter/exit transitions.
 * Must be inside a <Sequence> so useCurrentFrame() is relative.
 */
const SceneWithTransitions: React.FC<{
  entry: {
    scene: SceneItem;
    effectiveStart: number;
    enterType: TransitionType;
    enterOverlapStart: number;
    enterOverlapEnd: number;
    hasEnterTransition: boolean;
    exitType: TransitionType;
    exitOverlapStart: number;
    exitOverlapEnd: number;
    hasExitTransition: boolean;
  };
  renderScene: (sceneFile: string, frameOffset: number) => React.ReactNode;
}> = ({ entry, renderScene }) => {
  const frame = useCurrentFrame();
  const { scene } = entry;

  // Convert absolute overlap frames to sequence-relative frames
  const seqOffset = entry.effectiveStart;
  const relFrame = frame; // Already relative inside Sequence

  // Absolute frame for comparison
  const absFrame = seqOffset + relFrame;

  let style: React.CSSProperties = { position: 'absolute', inset: 0 };

  // Apply enter transition
  if (entry.hasEnterTransition && absFrame < entry.enterOverlapEnd) {
    const progress = interpolate(
      absFrame,
      [entry.enterOverlapStart, entry.enterOverlapEnd],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const transStyle = computeTransitionStyle(entry.enterType, progress, false);
    style = { ...style, ...transStyle };
  }

  // Apply exit transition
  if (entry.hasExitTransition && absFrame >= entry.exitOverlapStart) {
    const progress = interpolate(
      absFrame,
      [entry.exitOverlapStart, entry.exitOverlapEnd],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const transStyle = computeTransitionStyle(entry.exitType, progress, true);
    style = { ...style, ...transStyle };
  }

  return (
    <div style={style}>
      {renderScene(scene.sceneFile, scene.frameOffset ?? 0)}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/SceneTransitionLayer.tsx
git commit -m "feat(composition): add SceneTransitionLayer with overlapping sequences"
```

---

## Chunk 3: Integration

### Task 4: Update FullComposition to use SceneTransitionLayer

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/FullComposition.tsx`

When `sceneItems` + `renderScene` are provided, FullComposition delegates scene rendering to SceneTransitionLayer instead of rendering `children` through VisualsLayer. When they are absent, the existing `children` behavior is preserved (backward compatible).

- [ ] **Step 1: Read the current FullComposition**

Read `packages/worker/remotion-template/src/composition/FullComposition.tsx`.

- [ ] **Step 2: Add import and modify the component**

Add the import at the top:
```typescript
import { SceneTransitionLayer } from './SceneTransitionLayer';
```

Change the `Props` interface to:
```typescript
interface Props extends FullCompositionProps {
  children?: React.ReactNode;
}
```

In the component body, add a helper that decides how to render visuals:

```typescript
const hasSceneTransitions = sceneItems && sceneItems.length > 0 && renderScene;

// Helper: render visuals either via SceneTransitionLayer or children
const renderVisuals = (rect: Rect, opacity: number) => {
  if (hasSceneTransitions) {
    return (
      <SceneTransitionLayer
        sceneItems={sceneItems}
        renderScene={renderScene}
        rect={rect}
        opacity={opacity}
      />
    );
  }
  return (
    <VisualsLayer rect={rect} opacity={opacity}>
      {children}
    </VisualsLayer>
  );
};
```

Then replace all `<VisualsLayer rect={...} opacity={...}>{children}</VisualsLayer>` calls with `{renderVisuals(rect, opacity)}`.

There are 3 places in FullComposition that render visuals:
1. Audio-only mode (line 37-39): `<VisualsLayer rect={fullRect} opacity={1}>{children}</VisualsLayer>`
2. PiP mode (line 78-81): `<VisualsLayer rect={fullRect} opacity={1}>{children}</VisualsLayer>`
3. Stacked mode (line 122-124): `<VisualsLayer rect={visualsRect} opacity={visualsOpacity}>{children}</VisualsLayer>`

Replace each with:
```tsx
{renderVisuals(fullRect, 1)}    // audio-only
{renderVisuals(fullRect, 1)}    // PiP
{renderVisuals(visualsRect, visualsOpacity)}  // stacked
```

Also destructure `sceneItems` and `renderScene` from props alongside the existing destructured props.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/remotion-template/src/composition/FullComposition.tsx
git commit -m "feat(composition): integrate SceneTransitionLayer into FullComposition"
```

---

### Task 5: Update barrel exports

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/index.ts`

- [ ] **Step 1: Add new exports**

Add `SceneTransitionLayer` component export and new types:

```typescript
export { FullComposition } from './FullComposition';
export { SceneTransitionLayer } from './SceneTransitionLayer';
export { computeTransitionStyle } from './transitions';
export type {
  FullCompositionProps, LayoutSegment, Rect, DisplayMode,
  SplitSettings, VideoCropSettings,
  LayoutMode, PiPSettings,
  SubtitleItemData, SubtitleWordData, SubtitleStyle,
  SubtitlePosition, CaptionEffects, StrokeStyle,
  // Scene transitions
  SceneItem, SceneTransition, TransitionType,
} from './types';
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/index.ts
git commit -m "feat(composition): export scene transition types and components"
```

---

### Task 6: Update manifestToProps to include scene items

**Files:**
- Modify: `packages/worker/src/processors/render/manifest-to-props.ts`

The manifest stores transition data on visual items as `data.transition`. Extract this into `SceneItem[]` for FullComposition.

- [ ] **Step 1: Read manifest-to-props.ts and manifest visual item data schema**

Read `packages/worker/src/processors/render/manifest-to-props.ts`.
Read `packages/shared/src/manifest.ts` — check the visual item data schema for `transition`, `displayMode`, `frameOffset`, and `sceneFile` fields.

- [ ] **Step 2: Add SceneItem type locally**

Add a local `SceneItem` type (mirroring the remotion-template type, since we can't import across rootDir boundaries):

```typescript
interface SceneItem {
  id: string;
  startFrame: number;
  endFrame: number;
  sceneFile: string;
  displayMode: string;
  frameOffset?: number;
  enter?: { type: string; durationMs: number };
  exit?: { type: string; durationMs: number };
}
```

Add `sceneItems?: SceneItem[]` to the local `FullCompositionProps` interface.

- [ ] **Step 3: Add buildSceneItems function**

The manifest's visual item data schema uses `sceneFile` (not `compositionId`) to identify scenes. The items already carry `id` from the manifest item type.

```typescript
/**
 * Build SceneItem[] from manifest visual items.
 * Extracts transition config, sceneFile, frameOffset, and displayMode.
 */
function buildSceneItems(
  visualItems: Array<{ id: string; startMs: number; endMs: number; data: ManifestVisualItemData }>,
  fps: number,
): SceneItem[] {
  const sorted = [...visualItems].sort((a, b) => a.startMs - b.startMs);

  return sorted.map((item) => {
    const data = item.data as Record<string, unknown>;
    const transition = data.transition as {
      enter?: { type: string; durationMs: number };
      exit?: { type: string; durationMs: number };
    } | undefined;

    return {
      id: item.id,
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      sceneFile: (data.sceneFile as string) || '',
      displayMode: (data.displayMode as string) || 'default',
      frameOffset: (data.frameOffset as number) || undefined,
      enter: transition?.enter,
      exit: transition?.exit,
    };
  });
}
```

- [ ] **Step 4: Wire into manifestToProps**

In the `manifestToProps` function, after building `layoutSegments`, add:

```typescript
// Scene items with transition config
const sceneItems = buildSceneItems(visualItems, fps);
```

And add to the returned props:
```typescript
const props: FullCompositionProps = {
  // ... existing fields ...
  ...(sceneItems.length > 0 ? { sceneItems } : {}),
};
```

Note: `renderScene` is NOT set here — it's provided by the render processor or frontend at render time, since it depends on how scenes are loaded (workspace bundle vs. dynamic import).

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/processors/render/manifest-to-props.ts
git commit -m "feat(render): include scene items with transition config in manifestToProps"
```

---

### Task 7: TypeScript compilation check

**Files:** None (verification only)

- [ ] **Step 1: Check remotion-template compiles**

Run: `cd packages/worker/remotion-template && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Check worker package compiles**

Run: `cd packages/worker && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Fix any compilation errors and commit if needed**

```bash
git add packages/worker/
git commit -m "fix(composition): resolve compilation errors in scene transitions"
```
