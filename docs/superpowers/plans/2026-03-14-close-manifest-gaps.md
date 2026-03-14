# Close Manifest V2 Gaps Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between what manifest V2 supports and what the editor exposes — rendering, properties, data preservation, and performance.

**Architecture:** Four independent chunks: (A) render shapes+captions in codegen, (B) complete properties panel, (C) fix round-trip data loss in storeToManifest, (D) fix ItemDragOverlay performance and UX.

**Tech Stack:** React, Zustand, Zod, Remotion, TypeScript

---

## Chunk A: Player Rendering — Shape + Caption

### Task 1: Render shape items in codegen ItemRenderer

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts` (lines 353-354)

The shape case currently returns `null`. Replace it with a renderer that supports rectangle, circle, and line shapes with fill, stroke, strokeWidth, and borderRadius.

Reference implementation exists at `packages/worker/remotion-template/src/composition/ShapeOverlay.tsx`.

- [ ] **Step 1: Replace the shape case in ItemRenderer**

In `generatePlayerComposition`, inside the template string for `ItemRenderer`, replace:
```typescript
case 'shape':
  return null;
```
with:
```typescript
case 'shape': {
  const shapeType = d.shape || 'rectangle';
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: d.fill || 'transparent',
    border: d.strokeWidth ? \`\${d.strokeWidth}px solid \${d.stroke || '#FFFFFF'}\` : 'none',
  };

  if (shapeType === 'circle') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} />;
  }
  if (shapeType === 'line') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '100%', height: d.strokeWidth || 2, backgroundColor: d.stroke || d.fill || '#FFFFFF' }} />
      </div>
    );
  }
  // rectangle
  return <div style={{ ...baseStyle, borderRadius: d.borderRadius || 0 }} />;
}
```

- [ ] **Step 2: Test by loading a project with a shape item**

Verify the shape renders in the player preview. If no shape item exists, add one via the timeline toolbar.

- [ ] **Step 3: Commit**
```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat(codegen): render shape items (rectangle, circle, line) in PlayerComposition"
```

---

### Task 2: Render caption items in codegen ItemRenderer

**Files:**
- Modify: `packages/api/src/workspace/workspace-codegen.ts` (lines 350-351)

Caption rendering is more complex — it needs to show the current word(s) based on the playback time, styled according to `manifest.captionStyle`.

Reference: `packages/worker/remotion-template/src/composition/SubtitleLayer.tsx`

- [ ] **Step 1: Replace the caption case in ItemRenderer**

Replace:
```typescript
case 'caption':
  return null;
```
with a component that reads the caption words and renders the active word(s) based on `useCurrentFrame()` and `useVideoConfig()`:

```typescript
case 'caption': {
  const words: Array<{ text: string; startMs: number; endMs: number }> = d.words || [];
  if (words.length === 0) return null;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Find active words (within a ±500ms window for phrase grouping)
  const activeWords = words.filter(w => currentMs >= w.startMs && currentMs < w.endMs);
  if (activeWords.length === 0) return null;

  // Get caption style from manifest (passed via props)
  const cs = (item as any).__captionStyle || {};
  const fontSize = cs.fontSize || 56;
  const fontFamily = cs.fontFamily || 'Inter, system-ui, sans-serif';
  const fontWeight = cs.fontWeight || 800;
  const color = cs.color || '#FFFFFF';
  const activeColor = cs.activeColor || color;
  const bgColor = cs.backgroundColor || 'transparent';
  const textAlign = cs.position?.textAlign || 'center';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 40px 120px',
    }}>
      <div style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        textAlign,
        lineHeight: 1.2,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
        borderRadius: bgColor !== 'transparent' ? 8 : undefined,
        padding: bgColor !== 'transparent' ? '8px 16px' : undefined,
      }}>
        {activeWords.map((w, i) => (
          <span key={i} style={{ color: activeColor }}>{w.text} </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pass captionStyle to caption items in renderNLEComposition**

In the `renderNLEComposition` function, before rendering caption items, attach captionStyle from the manifest to each caption item:

```typescript
// Before the items.map, add:
const captionStyle = manifest?.captionStyle || {};

// Inside the items.map, for caption items, attach the style:
const itemWithMeta = item.type === 'caption'
  ? { ...item, __captionStyle: captionStyle }
  : item;
```

Then pass `itemWithMeta` to `<ItemRenderer item={itemWithMeta} />` instead of `item`.

- [ ] **Step 3: Update PlayerComposition to accept captionStyle**

The `PlayerComposition` component receives `manifest` as a prop. The `renderNLEComposition` function needs access to `manifest.captionStyle`. Update the function signature:
```typescript
function renderNLEComposition(items: any[], fps: number, captionStyle?: any) {
```
And pass `captionStyle` from the `PlayerComposition` caller.

- [ ] **Step 4: Test with a project that has captions**

- [ ] **Step 5: Commit**
```bash
git add packages/api/src/workspace/workspace-codegen.ts
git commit -m "feat(codegen): render caption items with word-by-word display and captionStyle"
```

---

## Chunk B: Properties Panel Completeness

### Task 3: Add text styling controls to DataTab

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/properties/DataTab.tsx` (lines 162-182)

Currently the text properties section only has a textarea for text content. Add controls for: fontFamily, fontSize, fontWeight, color, textAlign, backgroundColor.

- [ ] **Step 1: Expand TextProperties component**

In `DataTab.tsx`, find the `TextProperties` component (~line 162). After the text textarea, add:

```tsx
{/* Font Family */}
<div>
  <label className="text-xs text-zinc-400">Font Family</label>
  <input
    type="text"
    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white"
    value={data.style?.fontFamily || data.fontFamily || 'Inter'}
    onChange={(e) => onChange({ style: { ...(data.style || {}), fontFamily: e.target.value } })}
  />
</div>

{/* Font Size + Weight */}
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-zinc-400">Font Size</label>
    <NumberInput
      value={data.style?.fontSize || data.fontSize || 48}
      onChange={(v) => onChange({ style: { ...(data.style || {}), fontSize: v } })}
      min={8} max={200} step={1}
    />
  </div>
  <div>
    <label className="text-xs text-zinc-400">Weight</label>
    <NumberInput
      value={data.style?.fontWeight || data.fontWeight || 600}
      onChange={(v) => onChange({ style: { ...(data.style || {}), fontWeight: v } })}
      min={100} max={900} step={100}
    />
  </div>
</div>

{/* Color + Background */}
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-zinc-400">Color</label>
    <input
      type="color"
      className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
      value={data.style?.color || data.color || '#FFFFFF'}
      onChange={(e) => onChange({ style: { ...(data.style || {}), color: e.target.value } })}
    />
  </div>
  <div>
    <label className="text-xs text-zinc-400">Background</label>
    <input
      type="color"
      className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
      value={data.style?.backgroundColor || data.backgroundColor || '#000000'}
      onChange={(e) => onChange({ style: { ...(data.style || {}), backgroundColor: e.target.value } })}
    />
  </div>
</div>

{/* Text Align */}
<div>
  <label className="text-xs text-zinc-400">Align</label>
  <div className="flex gap-1">
    {(['left', 'center', 'right'] as const).map((align) => (
      <button
        key={align}
        className={`flex-1 py-1 text-xs rounded ${(data.style?.textAlign || data.textAlign || 'center') === align ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
        onClick={() => onChange({ style: { ...(data.style || {}), textAlign: align } })}
      >
        {align}
      </button>
    ))}
  </div>
</div>
```

Note: Check how `onChange` works in DataTab — it likely calls `updateItemData`. Ensure the style object is merged correctly, not replaced.

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/features/editor-v2/components/properties/DataTab.tsx
git commit -m "feat(properties): add text styling controls (font, size, weight, color, align)"
```

---

### Task 4: Add video crop, startFrom, and fade controls

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/properties/DataTab.tsx` (lines 74-124)

- [ ] **Step 1: Add startFrom, fadeIn, fadeOut controls to VideoProperties**

After the playback rate control (~line 121), add:

```tsx
{/* Start From (source offset) */}
<div>
  <label className="text-xs text-zinc-400">Start From (ms)</label>
  <NumberInput
    value={data.startFrom || 0}
    onChange={(v) => onChange({ startFrom: v })}
    min={0} step={100}
  />
</div>

{/* Fade In/Out */}
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-zinc-400">Fade In (ms)</label>
    <NumberInput
      value={data.fadeInMs || 0}
      onChange={(v) => onChange({ fadeInMs: v })}
      min={0} max={5000} step={100}
    />
  </div>
  <div>
    <label className="text-xs text-zinc-400">Fade Out (ms)</label>
    <NumberInput
      value={data.fadeOutMs || 0}
      onChange={(v) => onChange({ fadeOutMs: v })}
      min={0} max={5000} step={100}
    />
  </div>
</div>

{/* Crop */}
<div>
  <label className="text-xs text-zinc-400 mb-1 block">Crop</label>
  <div className="grid grid-cols-3 gap-2">
    <div>
      <label className="text-xs text-zinc-500">X</label>
      <NumberInput
        value={data.crop?.x ?? 50}
        onChange={(v) => onChange({ crop: { ...(data.crop || { x: 50, y: 50, scale: 1 }), x: v } })}
        min={0} max={100} step={1}
      />
    </div>
    <div>
      <label className="text-xs text-zinc-500">Y</label>
      <NumberInput
        value={data.crop?.y ?? 50}
        onChange={(v) => onChange({ crop: { ...(data.crop || { x: 50, y: 50, scale: 1 }), y: v } })}
        min={0} max={100} step={1}
      />
    </div>
    <div>
      <label className="text-xs text-zinc-500">Scale</label>
      <NumberInput
        value={data.crop?.scale ?? 1}
        onChange={(v) => onChange({ crop: { ...(data.crop || { x: 50, y: 50, scale: 1 }), scale: v } })}
        min={0.5} max={3} step={0.1}
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add playbackRate and fade controls to AudioProperties**

In `AudioProperties` (~line 126), after volume, add:

```tsx
<div>
  <label className="text-xs text-zinc-400">Playback Rate</label>
  <NumberInput
    value={data.playbackRate ?? 1}
    onChange={(v) => onChange({ playbackRate: v })}
    min={0.25} max={4} step={0.25}
  />
</div>
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-zinc-400">Fade In (ms)</label>
    <NumberInput value={data.fadeInMs || 0} onChange={(v) => onChange({ fadeInMs: v })} min={0} max={5000} step={100} />
  </div>
  <div>
    <label className="text-xs text-zinc-400">Fade Out (ms)</label>
    <NumberInput value={data.fadeOutMs || 0} onChange={(v) => onChange({ fadeOutMs: v })} min={0} max={5000} step={100} />
  </div>
</div>
```

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/features/editor-v2/components/properties/DataTab.tsx
git commit -m "feat(properties): add video crop/startFrom/fade, audio playbackRate/fade controls"
```

---

### Task 5: Add shape stroke controls

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/properties/DataTab.tsx` (lines 227-277)

- [ ] **Step 1: Add stroke, strokeWidth, borderRadius to ShapeProperties**

After the fill color picker (~line 273), add:

```tsx
{/* Stroke Color */}
<div>
  <label className="text-xs text-zinc-400">Stroke</label>
  <div className="flex gap-2 items-center">
    <input
      type="color"
      className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded cursor-pointer"
      value={data.stroke || '#FFFFFF'}
      onChange={(e) => onChange({ stroke: e.target.value })}
    />
    <span className="text-xs text-zinc-400">{data.stroke || '#FFFFFF'}</span>
  </div>
</div>

{/* Stroke Width + Border Radius */}
<div className="grid grid-cols-2 gap-2">
  <div>
    <label className="text-xs text-zinc-400">Stroke Width</label>
    <NumberInput
      value={data.strokeWidth || 0}
      onChange={(v) => onChange({ strokeWidth: v })}
      min={0} max={20} step={1}
    />
  </div>
  <div>
    <label className="text-xs text-zinc-400">Border Radius</label>
    <NumberInput
      value={data.borderRadius || 0}
      onChange={(v) => onChange({ borderRadius: v })}
      min={0} max={100} step={1}
    />
  </div>
</div>
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/features/editor-v2/components/properties/DataTab.tsx
git commit -m "feat(properties): add shape stroke, strokeWidth, borderRadius controls"
```

---

## Chunk C: Round-Trip Data Preservation

### Task 6: Fix storeToManifest data loss

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/manifest-bridge.ts`

The `storeToManifest` function drops fields when converting store items back to manifest format. Fix each item type.

- [ ] **Step 1: Fix video item data preservation**

In `storeToManifest`, find the video case (~line 551). Change from:
```typescript
return {
  src: d.src || '',
  crop: { x: 50, y: 50, scale: 1 },
  volume: d.volume ?? 1,
  playbackRate: d.playbackRate ?? 1,
  startFrom: d.startFrom ?? 0,
};
```
to:
```typescript
return {
  src: d.src || '',
  volume: d.volume ?? 1,
  playbackRate: d.playbackRate ?? 1,
  startFrom: d.startFrom ?? 0,
  ...(d.crop ? { crop: d.crop } : {}),
  ...(d.fadeInMs ? { fadeInMs: d.fadeInMs } : {}),
  ...(d.fadeOutMs ? { fadeOutMs: d.fadeOutMs } : {}),
};
```

- [ ] **Step 2: Fix audio item data preservation**

Change from:
```typescript
return {
  src: d.src || '',
  volume: d.volume ?? 1,
  enhancedSrc: d.enhancedSrc || null,
};
```
to:
```typescript
return {
  src: d.src || '',
  volume: d.volume ?? 1,
  playbackRate: d.playbackRate ?? 1,
  ...(d.enhancedSrc ? { enhancedSrc: d.enhancedSrc } : {}),
  ...(d.fadeInMs ? { fadeInMs: d.fadeInMs } : {}),
  ...(d.fadeOutMs ? { fadeOutMs: d.fadeOutMs } : {}),
};
```

- [ ] **Step 3: Fix text item data preservation**

Change from dropping style sub-fields to preserving them all:
```typescript
return {
  text: td.text || '',
  fontFamily: td.style?.fontFamily || td.fontFamily || 'Inter',
  fontSize: td.style?.fontSize || td.fontSize || 48,
  fontWeight: td.style?.fontWeight || td.fontWeight || 600,
  color: td.style?.color || td.color || '#FFFFFF',
  backgroundColor: td.style?.backgroundColor || td.backgroundColor,
  textAlign: td.style?.textAlign || td.textAlign || 'center',
  textTransform: td.style?.textTransform || td.textTransform || 'none',
  ...(td.style?.lineHeight != null ? { lineHeight: td.style.lineHeight } : {}),
  ...(td.style?.letterSpacing != null ? { letterSpacing: td.style.letterSpacing } : {}),
  ...(td.style?.borderRadius != null ? { borderRadius: td.style.borderRadius } : {}),
  ...(td.style?.padding != null ? { padding: td.style.padding } : {}),
};
```

- [ ] **Step 4: Fix image item data preservation**

Change from:
```typescript
return { src: d.src || '' };
```
to:
```typescript
return {
  src: d.src || '',
};
```
Image data is minimal — `src` is all that's needed. Position comes from `item.transform`.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/features/editor-v2/store/manifest-bridge.ts
git commit -m "fix(bridge): preserve video crop/fade, audio playbackRate/fade, text style fields in storeToManifest"
```

---

## Chunk D: ItemDragOverlay Performance & UX

### Task 7: Fix store subscription and scale calculation

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx`

- [ ] **Step 1: Replace full store subscription with specific selector**

Change (~line 89):
```typescript
const store = useEditorStore();
```
to:
```typescript
const updateTransform = useEditorStore((s) => s.updateTransform);
```

Then replace all `store.updateTransform(...)` calls with `updateTransform(...)`.

- [ ] **Step 2: Cache scale at drag start instead of per-mousemove**

In the mousedown handler, capture the scale value and store it in the drag ref:
```typescript
const scale = getScale();
dragRef.current = { ...dragState, scale };
```

In the mousemove handler, use `drag.scale` instead of calling `getScale()`.

- [ ] **Step 3: Preserve percentage values when possible**

When committing the final transform on mouseup, check if the original value was a percentage string. If the item originally had `width: '100%'`, and the user dragged it to exactly the canvas width, keep it as `'100%'`.

Simple approach: only convert to pixels if the value actually changed:
```typescript
const finalTransform: Record<string, number | string> = {};
const orig = selectedItem.transform;
if (Math.round(finalX) !== resolveToPixels(orig.x, canvasWidth)) finalTransform.x = Math.round(finalX);
if (Math.round(finalY) !== resolveToPixels(orig.y, canvasHeight)) finalTransform.y = Math.round(finalY);
if (Math.round(finalW) !== resolveToPixels(orig.width, canvasWidth)) finalTransform.width = Math.round(finalW);
if (Math.round(finalH) !== resolveToPixels(orig.height, canvasHeight)) finalTransform.height = Math.round(finalH);
if (Object.keys(finalTransform).length > 0) {
  updateTransform(selectedItemId, finalTransform);
}
```

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx
git commit -m "perf(overlay): fix store subscription, cache scale, preserve percentage values"
```

---

### Task 8: Add debouncing to TransformTab number inputs

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/properties/TransformTab.tsx`

- [ ] **Step 1: Add debounced dispatch for keyboard input**

The `handleChange` callback (~line 46) fires `store.updateTransform` on every keystroke. Wrap it with a debounce for text input while keeping immediate dispatch for slider/drag input.

Import or create a simple debounce:
```typescript
const debouncedUpdate = useRef(
  debounce((itemId: string, prop: string, value: number) => {
    store.updateTransform(itemId, { [prop]: value });
  }, 300)
).current;
```

Then in `handleChange`, use the debounced version:
```typescript
const handleChange = useCallback(
  (prop: TransformKey, value: number) => {
    if (keyframeModes[prop]) {
      store.addKeyframeAtTime(item.id, store.currentTimeMs, { [prop]: value });
    } else {
      debouncedUpdate(item.id, prop, value);
    }
  },
  [store, item.id, keyframeModes, debouncedUpdate],
);
```

If there's no `debounce` utility available, use a simple inline implementation:
```typescript
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/features/editor-v2/components/properties/TransformTab.tsx
git commit -m "perf(properties): debounce TransformTab number input dispatch (300ms)"
```

---

### Task 9: Improve drag overlay visual feedback

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx`

- [ ] **Step 1: Add visual feedback during drag**

When `isDragging` is true, change the selection border style:
- Idle: `1px solid #a855f7` (current)
- Dragging: `2px solid #a855f7` with `boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)'`

Add a dimension label during resize showing current width × height:
```tsx
{isDragging && dragRef.current?.mode === 'resize' && (
  <div style={{
    position: 'absolute',
    top: -24,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#a855f7',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  }}>
    {Math.round(displayW)} × {Math.round(displayH)}
  </div>
)}
```

- [ ] **Step 2: Increase handle hit area for better usability**

Change `HANDLE_HIT_AREA` from 20 to 24, and increase the visual handle from 8px to 10px for better visibility.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx
git commit -m "ux(overlay): improve drag feedback (glow, dimension label, larger handles)"
```
