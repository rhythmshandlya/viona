# Background Segmentation Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the frontend editor to display, interact with, and preview the 5-track depth compositing system. The backend (pipeline, Remotion compositing, agent prompts) is complete — this plan covers only the web frontend.

**Architecture:** The manifest already contains 5 tracks and person items when the sandbox agent builds them. The frontend needs to (1) recognize and style the sandwich tracks, (2) show segmentation status, (3) render the person track in preview, and (4) let the user see the depth layer structure. No new API endpoints — everything flows through the existing manifest.

**Tech Stack:** React, Zustand (editor store), Tailwind CSS, Remotion Player, Lucide icons

---

## Current State

**What exists:**
- `SegmentationData`, `SpeakerBbox`, `SpeakerCenter`, `VisibleZones` types in store
- `SANDWICH_TRACK_NAMES` constant
- `'person'` in `TimelineItemType`
- `SegmentationStatus` component (built, never rendered anywhere)
- `useVideoSegmentation()` selector hook
- `getVideoSegmentation()` store action
- `TrackHeader` component with icon mapping (no person/depth icons)

**What's missing (from spec lines 176-182, 634-635):**
1. SegmentationStatus is an orphan — not mounted in any UI
2. Track headers don't recognize sandwich track names (scene-bg, person, scene-fg)
3. No visual distinction between depth tracks and normal tracks
4. Person track has no icon
5. No segmentation status in video track header or inspector
6. Timeline doesn't highlight the sandwich structure
7. No depth layer labels on track headers

---

### Task 1: Add person/depth track icons to TrackHeader

The `TrackHeader` maps track type → icon but has no entries for the sandwich tracks. The sandwich tracks all have `type: 'overlay'` so they all get the generic `Image` icon. We need to differentiate by track **name**.

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx`

- [ ] **Step 1: Add name-based icon override**

After the existing `TRACK_ICONS` map (line 13-20), add a name-based override map for sandwich tracks:

```tsx
import { Film, Volume2, MessageSquare, Type, Image, Lock, Unlock, Eye, EyeOff, ChevronRight, ChevronDown, Sparkles, User, Layers, ArrowUpFromLine, ArrowDownFromLine } from 'lucide-react';

/** Override icon by track name for sandwich depth tracks. */
const TRACK_NAME_ICONS: Record<string, React.ComponentType<any>> = {
  'scene-bg': ArrowDownFromLine,
  'person': User,
  'scene-fg': ArrowUpFromLine,
};
```

Then in the component, resolve icon by name first, then type:

```tsx
const Icon = TRACK_NAME_ICONS[track.name] || TRACK_ICONS[track.type] || Type;
```

- [ ] **Step 2: Add depth layer label colors**

Add a subtle color tint for sandwich tracks so they're visually grouped:

```tsx
const TRACK_NAME_COLORS: Record<string, string> = {
  'scene-bg': 'text-blue-400',
  'person': 'text-emerald-400',
  'scene-fg': 'text-amber-400',
};

const nameColorClass = TRACK_NAME_COLORS[track.name] || 'text-[var(--editor-text-secondary)]';
```

Apply `nameColorClass` to the track name `<span>` and the `<Icon>` component.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx
git commit -m "feat(editor): add depth track icons and color labels for sandwich tracks"
```

---

### Task 2: Show SegmentationStatus in video track header

The `SegmentationStatus` component exists but is never mounted. Show it in the video track header when segmentation data is available.

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx`

- [ ] **Step 1: Import SegmentationStatus and hook**

```tsx
import { SegmentationStatus } from '../../components/SegmentationStatus';
import { useEditorStore } from '../../store/use-editor-store';
import type { VideoItemData } from '../../store/types';
```

- [ ] **Step 2: Find the video item's segmentation data**

Inside the `TrackHeader` component, get segmentation data when the track is a video track:

```tsx
const segmentation = useEditorStore((state) => {
  if (track.type !== 'video') return undefined;
  const videoItem = state.itemIds
    .map(id => state.items[id])
    .find(item => item?.trackId === track.id && item.type === 'video');
  if (!videoItem) return undefined;
  return (videoItem.data as VideoItemData).segmentation;
});
```

- [ ] **Step 3: Render SegmentationStatus in the track header**

After the track name span and before the controls div, add a conditional render:

```tsx
{/* Segmentation status for video tracks */}
{segmentation && (
  <SegmentationStatus segmentation={segmentation} className="ml-auto mr-1" />
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/track-headers/TrackHeader.tsx
git commit -m "feat(editor): show segmentation status in video track header"
```

---

### Task 3: Add person track auto-lock and collapse

The person track is managed by the pipeline, not the user. It should be locked and collapsed by default so it doesn't take up timeline space. The user can still expand it to see the person item.

**Files:**
- Modify: `apps/web/src/features/editor-v2/store/editor-store.ts` (or wherever manifest→store conversion happens)

- [ ] **Step 1: Find the manifest-to-store conversion**

Search for where tracks are converted from manifest format to store format. Look for `manifestToStore` or `convertManifestTrack` or wherever `Track` objects are created from manifest data.

- [ ] **Step 2: Auto-lock and collapse the person track**

In the track conversion, when the track name is `'person'`:

```typescript
const isPersonTrack = manifestTrack.name === 'person';

return {
  id: manifestTrack.id,
  type: manifestTrack.type,
  name: manifestTrack.name,
  position: manifestTrack.position,
  locked: isPersonTrack ? true : false,
  visible: true,
  height: isPersonTrack ? 28 : (manifestTrack.type === 'video' ? 80 : manifestTrack.type === 'audio' ? 36 : 28),
  collapsed: isPersonTrack ? true : false,
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/store/editor-store.ts
git commit -m "feat(editor): auto-lock and collapse person track in timeline"
```

---

### Task 4: Add depth layer badge to scene items on sandwich tracks

When a scene item sits on `scene-bg` or `scene-fg`, add a small badge/tag on the timeline item so the user can see which depth layer it's on at a glance.

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` (where timeline items are rendered)

- [ ] **Step 1: Read TimelineCanvas.tsx**

Read the file to understand how timeline items are rendered on the canvas. Find where item rectangles or chips are drawn.

- [ ] **Step 2: Add depth badge rendering**

When drawing a scene item, check the parent track's name. If it's `scene-bg` or `scene-fg`, render a small label:

```tsx
const trackName = tracks.find(t => t.id === item.trackId)?.name;
const depthLabel = trackName === 'scene-bg' ? 'BG' : trackName === 'scene-fg' ? 'FG' : null;
```

Render the badge as a small pill in the top-right corner of the item chip:

```tsx
{depthLabel && (
  <span className={`absolute top-0.5 right-1 text-[8px] font-bold px-1 rounded ${
    depthLabel === 'BG' ? 'bg-blue-500/30 text-blue-300' : 'bg-amber-500/30 text-amber-300'
  }`}>
    {depthLabel}
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx
git commit -m "feat(editor): add BG/FG depth badges on scene items in sandwich tracks"
```

---

### Task 5: Show segmentation status in the inspector panel

When a video item is selected, the right-panel inspector should show the segmentation status.

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/inspector/ItemInspector.tsx`

- [ ] **Step 1: Read ItemInspector.tsx**

Understand how the inspector renders different sections for selected items. Find where video-specific sections are rendered.

- [ ] **Step 2: Add SegmentationStatus section for video items**

When the selected item is a video type, add a section:

```tsx
import { SegmentationStatus } from '../SegmentationStatus';

// Inside the video section:
{item.type === 'video' && (item.data as VideoItemData).segmentation && (
  <InspectorSection title="Speaker Extraction">
    <SegmentationStatus segmentation={(item.data as VideoItemData).segmentation} />
  </InspectorSection>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/inspector/ItemInspector.tsx
git commit -m "feat(editor): show segmentation status in video item inspector"
```

---

### Task 6: Handle person item in ItemDragOverlay

When dragging items in the timeline, the drag overlay needs to render something for person items.

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx`

- [ ] **Step 1: Read ItemDragOverlay.tsx**

Check if there's a switch/case for item types. See if `'person'` is handled or falls through to default.

- [ ] **Step 2: Add person item drag overlay**

Add a case for `'person'` type that renders a simple label:

```tsx
case 'person':
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-300">
      <User size={12} />
      Speaker Layer
    </div>
  );
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ItemDragOverlay.tsx
git commit -m "feat(editor): add person item drag overlay"
```

---

### Task 7: Show depth layer info in AI chat progress

When the AI agent requests segmentation or reports depth compositing activity, the ActiveTaskList should display it meaningfully.

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx`

- [ ] **Step 1: Read ActiveTaskList.tsx**

Understand how active tasks are displayed. Check if tool names are shown or if there's a mapping from tool name → display label.

- [ ] **Step 2: Add segmentation tool display names**

If there's a tool name mapping, add entries for segmentation tools:

```tsx
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // ... existing entries
  'request_segmentation': 'Requesting speaker segmentation...',
  'check_segmentation_status': 'Checking segmentation status...',
  'get_depth_compositing_info': 'Checking depth compositing...',
};
```

If the component uses a different pattern, adapt accordingly — read the file first.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/ai-chat/ActiveTaskList.tsx
git commit -m "feat(editor): show segmentation tool activity in AI chat"
```

---

## Task Dependency Order

All tasks are independent — they can be batched freely:
- **Batch A** (timeline): Tasks 1, 2, 3, 4 (track headers + timeline items)
- **Batch B** (panels): Tasks 5, 6, 7 (inspector + drag + chat)

## Out of Scope (per spec line 617-623)

- Real-time depth compositing preview toggle (V2)
- User-facing matte threshold/feather controls (V2)
- Drag items between scene-bg and scene-fg tracks (V2 — AI agent handles placement)
- Speaker bbox overlay on canvas preview (V2)
- Per-element depth targeting UI (V2 — AI agent decides layer per element)
