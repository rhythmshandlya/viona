# P3: Advanced Features — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shape rendering, keyframe animation interpolation in preview, and CSS filter rendering to the overlay layer.

**Architecture:** A new ShapeOverlay component renders rectangles, circles, and lines. The OverlayLayer is extended to interpolate transform properties between keyframes using Remotion's `interpolate()` with proper easing and clamping. CSS filters are applied as a filter string on each overlay's positioned div. A "Add Shape" button is added to AddItemToolbar.

**Tech Stack:** Remotion (interpolate, Easing, spring, useCurrentFrame), CSS filters, React, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-basic-editor-capabilities-design.md` (P3 section)

**Depends on:** P0 (OverlayLayer must exist)

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/worker/remotion-template/src/composition/ShapeOverlay.tsx` | Renders rectangle/circle/line with fill/stroke |
| `packages/worker/remotion-template/src/composition/useKeyframeInterpolation.ts` | Hook that interpolates transform props between keyframes for current frame |

### Modified Files

| File | Change |
|------|--------|
| `packages/worker/remotion-template/src/composition/OverlayLayer.tsx` | Add shape type, use keyframe interpolation hook, apply interpolated transforms |
| `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx` | Add "Add Shape" button |

---

### Task 1: ShapeOverlay Component

**Files:**
- Create: `packages/worker/remotion-template/src/composition/ShapeOverlay.tsx`

- [ ] **Step 1: Create ShapeOverlay component**

```tsx
// packages/worker/remotion-template/src/composition/ShapeOverlay.tsx
import React from 'react';

interface ShapeOverlayProps {
  data: {
    shape: 'rectangle' | 'circle' | 'line';
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: number;
  };
}

export const ShapeOverlay: React.FC<ShapeOverlayProps> = ({ data }) => {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: data.fill || '#FFFFFF',
    border: data.stroke ? `${data.strokeWidth || 1}px solid ${data.stroke}` : undefined,
  };

  switch (data.shape) {
    case 'circle':
      return <div style={{ ...baseStyle, borderRadius: '50%' }} />;

    case 'line':
      return (
        <div
          style={{
            width: '100%',
            height: data.strokeWidth || 2,
            backgroundColor: data.fill || '#FFFFFF',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      );

    case 'rectangle':
    default:
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: data.borderRadius ?? 0,
          }}
        />
      );
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/ShapeOverlay.tsx
git commit -m "feat(remotion): add ShapeOverlay component for rectangle/circle/line"
```

---

### Task 2: Keyframe Interpolation Hook

**Files:**
- Create: `packages/worker/remotion-template/src/composition/useKeyframeInterpolation.ts`

- [ ] **Step 1: Create the hook**

```typescript
// packages/worker/remotion-template/src/composition/useKeyframeInterpolation.ts
import { useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from 'remotion';

interface TransformProps {
  x: number | string;
  y: number | string;
  width: number | string;
  height: number | string;
  rotation: number;
  opacity: number;
}

interface KeyframeInput {
  timeMs: number;
  props: Partial<TransformProps>;
  easing?: string;
}

function mapEasing(easingStr: string | undefined): ((t: number) => number) {
  switch (easingStr) {
    case 'ease-in':
      return Easing.in(Easing.ease);
    case 'ease-out':
      return Easing.out(Easing.ease);
    case 'ease-in-out':
      return Easing.inOut(Easing.ease);
    case 'linear':
    default:
      if (easingStr?.startsWith('cubic-bezier(')) {
        const match = easingStr.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/);
        if (match) {
          return Easing.bezier(
            parseFloat(match[1]),
            parseFloat(match[2]),
            parseFloat(match[3]),
            parseFloat(match[4]),
          );
        }
      }
      return Easing.linear;
  }
}

/**
 * Interpolates numeric transform properties between keyframes.
 * Returns the interpolated transform for the current frame.
 * String values (like '50%') are NOT interpolated — they snap to the nearest keyframe.
 */
export function useKeyframeInterpolation(
  baseTransform: TransformProps | undefined,
  keyframes: KeyframeInput[] | undefined,
): TransformProps {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const defaults: TransformProps = {
    x: baseTransform?.x ?? 0,
    y: baseTransform?.y ?? 0,
    width: baseTransform?.width ?? '100%',
    height: baseTransform?.height ?? '100%',
    rotation: baseTransform?.rotation ?? 0,
    opacity: baseTransform?.opacity ?? 1,
  };

  if (!keyframes || keyframes.length === 0) {
    return defaults;
  }

  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

  // Interpolate each numeric property
  const numericProps: (keyof TransformProps)[] = ['rotation', 'opacity'];

  const result = { ...defaults };

  for (const prop of numericProps) {
    // Collect keyframes that define this property
    const propKeyframes = sorted
      .filter((kf) => kf.props[prop] != null)
      .map((kf) => ({
        frame: Math.round((kf.timeMs / 1000) * fps),
        value: kf.props[prop] as number,
        easing: kf.easing,
      }));

    if (propKeyframes.length === 0) continue;
    if (propKeyframes.length === 1) {
      // Single keyframe — snap
      (result as any)[prop] = propKeyframes[0].value;
      continue;
    }

    // Build input/output arrays for interpolate()
    const frames = propKeyframes.map((kf) => kf.frame);
    const values = propKeyframes.map((kf) => kf.value);

    // Use the easing of the second keyframe in each pair
    // For simplicity, use the easing of the nearest next keyframe
    const easing = mapEasing(propKeyframes[1]?.easing);

    (result as any)[prop] = interpolate(frame, frames, values, {
      easing,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  // For position/size props that can be strings: snap to nearest keyframe value
  const mixedProps: (keyof TransformProps)[] = ['x', 'y', 'width', 'height'];
  for (const prop of mixedProps) {
    const propKeyframes = sorted
      .filter((kf) => kf.props[prop] != null)
      .map((kf) => ({
        frame: Math.round((kf.timeMs / 1000) * fps),
        value: kf.props[prop]!,
        easing: kf.easing,
      }));

    if (propKeyframes.length === 0) continue;

    // If all values are numbers, interpolate
    const allNumeric = propKeyframes.every((kf) => typeof kf.value === 'number');
    if (allNumeric && propKeyframes.length >= 2) {
      const frames = propKeyframes.map((kf) => kf.frame);
      const values = propKeyframes.map((kf) => kf.value as number);
      const easing = mapEasing(propKeyframes[1]?.easing);
      (result as any)[prop] = interpolate(frame, frames, values, {
        easing,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    } else {
      // Mixed or single — snap to nearest
      let closest = propKeyframes[0];
      for (const kf of propKeyframes) {
        if (Math.abs(kf.frame - frame) < Math.abs(closest.frame - frame)) {
          closest = kf;
        }
      }
      (result as any)[prop] = closest.value;
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/worker/remotion-template/src/composition/useKeyframeInterpolation.ts
git commit -m "feat(remotion): add useKeyframeInterpolation hook for animated transforms"
```

---

### Task 3: Integrate keyframes + shapes + filters into OverlayLayer

**Files:**
- Modify: `packages/worker/remotion-template/src/composition/OverlayLayer.tsx`

- [ ] **Step 1: Read current OverlayLayer.tsx**

Read the file created in P0.

- [ ] **Step 2: Add ShapeOverlay import**

```typescript
import { ShapeOverlay } from './ShapeOverlay';
```

- [ ] **Step 3: Add shape rendering in the item type switch**

In the render section, add:
```tsx
{item.type === 'shape' && <ShapeOverlay data={item.data} />}
```

- [ ] **Step 4: Extract the per-item rendering into a wrapper component**

To use the `useKeyframeInterpolation` hook (hooks can't be called conditionally), extract each item's rendering into a separate component:

```tsx
import { useKeyframeInterpolation } from './useKeyframeInterpolation';

const OverlayItem: React.FC<{ item: OverlayItemType }> = ({ item }) => {
  const interpolatedTransform = useKeyframeInterpolation(
    item.transform,
    item.keyframes,
  );

  const filterStr = buildFilterString(item.filters);

  return (
    <div
      style={{
        position: 'absolute',
        left: interpolatedTransform.x,
        top: interpolatedTransform.y,
        width: interpolatedTransform.width,
        height: interpolatedTransform.height,
        transform: interpolatedTransform.rotation ? `rotate(${interpolatedTransform.rotation}deg)` : undefined,
        opacity: interpolatedTransform.opacity,
        filter: filterStr,
      }}
    >
      {item.type === 'text' && <TextOverlay data={item.data} />}
      {item.type === 'image' && <ImageOverlay data={item.data} />}
      {item.type === 'video' && <VideoOverlay data={item.data} />}
      {item.type === 'shape' && <ShapeOverlay data={item.data} />}
    </div>
  );
};
```

Then in the main `OverlayLayer`, replace the inline div with `<OverlayItem item={item} />`.

- [ ] **Step 5: Verify compilation**

Run: `cd packages/worker && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "Overlay|overlay|Keyframe" || echo "No errors"`

- [ ] **Step 6: Commit**

```bash
git add packages/worker/remotion-template/src/composition/OverlayLayer.tsx
git commit -m "feat(remotion): integrate shapes, keyframe interpolation, and filters into OverlayLayer"
```

---

### Task 4: Add "Add Shape" button to toolbar

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx`

- [ ] **Step 1: Add shape button**

Import `Square` icon from lucide-react and add a button:

```tsx
import { Square } from 'lucide-react';

// Add handler:
const handleAddShape = () => {
  const state = useEditorStore.getState();
  const trackId = findOrCreateTrack(state.tracks, 'overlay', actions.addTrack);
  const startMs = state.currentTimeMs;
  const id = `item-shape-${Date.now()}`;
  const item: TimelineItem = {
    id,
    type: 'shape',
    trackId,
    startMs,
    endMs: startMs + 3000,
    data: {
      shape: 'rectangle',
      fill: '#3B82F6',
      borderRadius: 8,
    } as any,
    transform: { x: '25%', y: '25%', width: '50%', height: '50%', rotation: 0, opacity: 1 },
  };
  actions.addItem(trackId, item);
  actions.select([id]);
};

// Add button in JSX:
<button style={buttonStyle} onClick={handleAddShape} title="Add shape">
  <Square size={14} /> Shape
</button>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AddItemToolbar.tsx
git commit -m "feat(editor): add shape button to AddItemToolbar"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | ShapeOverlay component | New: ShapeOverlay.tsx |
| 2 | Keyframe interpolation hook | New: useKeyframeInterpolation.ts |
| 3 | Integrate into OverlayLayer | Modify: OverlayLayer.tsx |
| 4 | Add Shape button | Modify: AddItemToolbar.tsx |
