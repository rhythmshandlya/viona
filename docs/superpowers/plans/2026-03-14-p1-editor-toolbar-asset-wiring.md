# P1: Editor Toolbar & Asset Wiring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users UI to add text, image, audio, and video items to the timeline, upload media files, manage tracks, and drag assets from the panel to the timeline.

**Architecture:** A new AddItemToolbar provides buttons for each item type. Clicking a button either creates an item directly (text) or opens a file picker, uploads to S3, then creates an item referencing the asset key. AssetsPanel is extended to accept all media types. Timeline canvas gets drop zone handling. Track headers get a "+" button.

**Tech Stack:** React, Zustand, S3/MinIO upload, Lucide icons, shadcn/ui dropdown

**Spec:** `docs/superpowers/specs/2026-03-14-basic-editor-capabilities-design.md` (P1 section)

**Depends on:** P0 (overlay rendering must work for new items to be visible)

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx` | Button row with Add Text, Add Image, Add Audio, Add Video |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/features/editor-v2/Editor.tsx` | Mount AddItemToolbar above timeline |
| `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx` | Extend mime filter, add "Insert at playhead" button |
| `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx` | Add dragover/drop handlers for asset drops |
| `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeaders.tsx` | Add "+" button for track creation |
| `apps/web/src/features/editor-v2/components/RightPanel.tsx` | Auto-switch to item-properties tab on selection |

---

## Chunk 1: AddItemToolbar & Item Creation

### Task 1: Create AddItemToolbar component

**Files:**
- Create: `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx`

- [ ] **Step 1: Create the toolbar component**

```tsx
// apps/web/src/features/editor-v2/components/AddItemToolbar.tsx
'use client';

import React, { useRef } from 'react';
import { Type, ImageIcon, Music, Film } from 'lucide-react';
import { useEditorActions, useEditorStore } from '../store/use-editor-store';
import { api } from '@/lib/api';
import type { Track, TimelineItem, TextItemData, TextStyle } from '../store/types';

/** Find or create a track of the given type */
function findOrCreateTrack(
  tracks: Track[],
  trackType: string,
  addTrack: (track: Track) => void,
): string {
  // Find existing track of matching type
  const existing = tracks.find((t) => t.type === trackType);
  if (existing) return existing.id;

  // Auto-create
  const count = tracks.filter((t) => t.type === trackType).length;
  const name =
    trackType === 'overlay'
      ? `Overlay ${count + 1}`
      : trackType === 'audio'
        ? `Audio ${count + 1}`
        : `Video ${count + 1}`;
  const id = `track-${trackType}-${Date.now()}`;
  const newTrack: Track = {
    id,
    type: trackType as Track['type'],
    name,
    position: tracks.length,
    height: 60,
    locked: false,
    visible: true,
    collapsed: false,
  };
  addTrack(newTrack);
  return id;
}

export function AddItemToolbar() {
  const actions = useEditorActions();
  const projectId = useEditorStore((s) => s.project?.id);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAddText = () => {
    const state = useEditorStore.getState();
    const trackId = findOrCreateTrack(state.tracks, 'overlay', actions.addTrack);
    const startMs = state.currentTimeMs;
    const id = `item-text-${Date.now()}`;
    const data: TextItemData = {
      text: 'Your text here',
      style: {
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: 600,
        color: '#FFFFFF',
        textAlign: 'center',
      } as TextStyle,
      position: { x: 0, y: 0 },
      size: { width: 800, height: 200 },
    };
    const item: TimelineItem = {
      id,
      type: 'text',
      trackId,
      startMs,
      endMs: startMs + 3000,
      data,
      transform: { x: '10%', y: '40%', width: '80%', height: '20%', rotation: 0, opacity: 1 },
    };
    actions.addItem(trackId, item);
    actions.select([id]);
  };

  const handleMediaUpload = async (
    file: File,
    itemType: 'image' | 'audio' | 'video',
    trackType: string,
  ) => {
    if (!projectId) return;
    try {
      const asset = await api.uploadProjectMedia(projectId, file);
      const state = useEditorStore.getState();
      const trackId = findOrCreateTrack(state.tracks, trackType, actions.addTrack);
      const startMs = state.currentTimeMs;
      const id = `item-${itemType}-${Date.now()}`;

      // Default duration: 5s for images, use metadata or 10s for audio/video
      const durationMs = itemType === 'image' ? 5000 : 10000;

      const baseItem: Partial<TimelineItem> = {
        id,
        type: itemType,
        trackId,
        startMs,
        endMs: startMs + durationMs,
      };

      if (itemType === 'image') {
        baseItem.data = { src: asset.url } as any;
        baseItem.transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      } else if (itemType === 'audio') {
        baseItem.data = { src: asset.url, volume: 1 } as any;
      } else if (itemType === 'video') {
        baseItem.data = { src: asset.url, width: 1920, height: 1080, volume: 1, playbackRate: 1, startFrom: 0 } as any;
        baseItem.transform = { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 };
      }

      actions.addItem(trackId, baseItem as TimelineItem);
      actions.select([id]);
    } catch (err) {
      console.error(`Failed to upload ${itemType}:`, err);
    }
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--editor-border-subtle, #333)',
    borderRadius: 6,
    background: 'var(--editor-bg-secondary, #1a1a1a)',
    color: 'var(--editor-text-secondary, #999)',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '4px 12px',
        borderBottom: '1px solid var(--editor-border-subtle, #2a2a2a)',
        background: 'var(--editor-bg-primary, #111)',
      }}
    >
      <button style={buttonStyle} onClick={handleAddText} title="Add text overlay">
        <Type size={14} /> Text
      </button>
      <button
        style={buttonStyle}
        onClick={() => imageInputRef.current?.click()}
        title="Add image overlay"
      >
        <ImageIcon size={14} /> Image
      </button>
      <button
        style={buttonStyle}
        onClick={() => audioInputRef.current?.click()}
        title="Add background audio"
      >
        <Music size={14} /> Audio
      </button>
      <button
        style={buttonStyle}
        onClick={() => videoInputRef.current?.click()}
        title="Add video clip"
      >
        <Film size={14} /> Video
      </button>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'image', 'overlay');
          e.target.value = '';
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'audio', 'audio');
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMediaUpload(file, 'video', 'video');
          e.target.value = '';
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep AddItemToolbar || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/AddItemToolbar.tsx
git commit -m "feat(editor): add AddItemToolbar with text, image, audio, video buttons"
```

---

### Task 2: Mount AddItemToolbar in Editor

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

- [ ] **Step 1: Read Editor.tsx to find where to mount the toolbar**

Read the file, find where the timeline is rendered. The toolbar should go directly above the timeline.

- [ ] **Step 2: Import and mount AddItemToolbar**

Add import:
```typescript
import { AddItemToolbar } from './components/AddItemToolbar';
```

Mount it above the timeline section:
```tsx
<AddItemToolbar />
{/* existing timeline */}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(editor): mount AddItemToolbar above timeline"
```

---

## Chunk 2: AssetsPanel Extension & Track Creation

### Task 3: Extend AssetsPanel to accept all media types

**Files:**
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx`

- [ ] **Step 1: Read AssetsPanel.tsx**

Read the file to find:
- The `accept` attribute on the file input (currently `image/*,.svg`)
- The upload section layout
- How assets are displayed in the grid

- [ ] **Step 2: Extend mime filter**

Change the file input accept attribute:
```tsx
// Before:
accept="image/*,.svg"
// After:
accept="image/*,audio/*,video/*,.svg"
```

- [ ] **Step 3: Add type badge to asset grid items**

In the asset grid rendering, add a type indicator based on `asset.mimeType`:

```tsx
function getAssetTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.startsWith('video/')) return 'Video';
  return 'Image';
}

function getAssetTypeIcon(mimeType: string) {
  if (mimeType.startsWith('audio/')) return <Music size={12} />;
  if (mimeType.startsWith('video/')) return <Film size={12} />;
  return <ImageIcon size={12} />;
}
```

- [ ] **Step 4: Add "Insert at playhead" button on assets**

On each uploaded asset in the grid, add a small button that creates a timeline item at the current playhead position:

```tsx
const handleInsertAsset = (asset: ProjectMediaAsset) => {
  const state = useEditorStore.getState();
  const { addItem, select, addTrack } = state;
  const startMs = state.currentTimeMs;

  let itemType: string;
  let trackType: string;
  if (asset.mimeType.startsWith('audio/')) {
    itemType = 'audio';
    trackType = 'audio';
  } else if (asset.mimeType.startsWith('video/')) {
    itemType = 'video';
    trackType = 'video';
  } else {
    itemType = 'image';
    trackType = 'overlay';
  }

  const trackId = findOrCreateTrack(state.tracks, trackType, addTrack);
  const id = `item-${itemType}-${Date.now()}`;
  const durationMs = itemType === 'image' ? 5000 : 10000;

  const item: TimelineItem = {
    id,
    type: itemType as any,
    trackId,
    startMs,
    endMs: startMs + durationMs,
    data: { src: asset.url, volume: 1 } as any,
    ...(itemType !== 'audio' ? {
      transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
    } : {}),
  };

  addItem(trackId, item);
  select([id]);
};
```

Add `findOrCreateTrack` helper (same as in AddItemToolbar — consider extracting to a shared util if it feels like duplication).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor-v2/panels/AssetsPanel.tsx
git commit -m "feat(assets): extend AssetsPanel to accept audio/video, add insert-at-playhead"
```

---

### Task 4: Add track creation button

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/track-headers/TrackHeaders.tsx`

- [ ] **Step 1: Read TrackHeaders.tsx**

Read the file to understand the layout and how track headers are rendered.

- [ ] **Step 2: Add "+" button at the bottom**

After the existing track headers, add a button row:

```tsx
import { Plus } from 'lucide-react';

// At the bottom of the track headers container:
<div style={{ padding: '4px 8px', borderTop: '1px solid var(--editor-border-subtle, #2a2a2a)' }}>
  <button
    onClick={() => setShowAddMenu(!showAddMenu)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 8px',
      fontSize: 11,
      color: 'var(--editor-text-muted, #666)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      width: '100%',
    }}
    title="Add track"
  >
    <Plus size={12} /> Add Track
  </button>
  {showAddMenu && (
    <div style={{
      position: 'absolute',
      background: 'var(--editor-bg-secondary, #1a1a1a)',
      border: '1px solid var(--editor-border-subtle, #333)',
      borderRadius: 6,
      padding: 4,
      zIndex: 100,
    }}>
      {['video', 'audio', 'overlay'].map((type) => (
        <button
          key={type}
          onClick={() => {
            handleAddTrack(type);
            setShowAddMenu(false);
          }}
          style={{ display: 'block', width: '100%', padding: '4px 12px', textAlign: 'left', fontSize: 12, background: 'none', border: 'none', color: 'var(--editor-text-primary, #ccc)', cursor: 'pointer' }}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)} Track
        </button>
      ))}
    </div>
  )}
</div>
```

The `handleAddTrack` function:
```tsx
const handleAddTrack = (type: string) => {
  const tracks = useEditorStore.getState().tracks;
  const count = tracks.filter((t) => t.type === type).length;
  const names: Record<string, string> = { video: 'Video', audio: 'Audio', overlay: 'Overlay' };
  const track: Track = {
    id: `track-${type}-${Date.now()}`,
    type: type as Track['type'],
    name: `${names[type] || type} ${count + 1}`,
    position: tracks.length,
    height: 60,
    locked: false,
    visible: true,
    collapsed: false,
  };
  actions.addTrack(track);
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/track-headers/TrackHeaders.tsx
git commit -m "feat(timeline): add track creation button with type dropdown"
```

---

## Chunk 3: Timeline Drop Zone & Properties Auto-Switch

### Task 5: Add drop zone to timeline canvas

**Files:**
- Modify: `apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx`

- [ ] **Step 1: Read TimelineCanvas.tsx**

Read the file to find:
- The `<canvas>` element and its event handlers
- The existing pointer event handlers (`handlePointerDown`, etc.)
- Access to `hitTester` for coordinate conversion

- [ ] **Step 2: Add dragover and drop handlers**

On the canvas element, add:

```tsx
onDragOver={(e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}}
onDrop={(e) => {
  e.preventDefault();
  const assetJson = e.dataTransfer.getData('application/x-project-asset')
    || e.dataTransfer.getData('application/x-broll-asset');
  if (!assetJson) return;

  try {
    const asset = JSON.parse(assetJson);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const timeMs = hitTester.xToTime(x);
    const track = hitTester.getTrackAtY(y);

    // Determine item type from asset mime
    let itemType: string;
    let trackType: string;
    if (asset.mimeType?.startsWith('audio/')) {
      itemType = 'audio';
      trackType = 'audio';
    } else if (asset.mimeType?.startsWith('video/')) {
      itemType = 'video';
      trackType = 'video';
    } else {
      itemType = 'image';
      trackType = 'overlay';
    }

    const state = useEditorStore.getState();
    const trackId = track?.id || findOrCreateTrack(state.tracks, trackType, state.addTrack);
    const id = `item-${itemType}-${Date.now()}`;
    const durationMs = itemType === 'image' ? 5000 : 10000;

    const item: TimelineItem = {
      id,
      type: itemType as any,
      trackId,
      startMs: Math.max(0, timeMs),
      endMs: Math.max(0, timeMs) + durationMs,
      data: { src: asset.url, volume: 1 } as any,
      ...(itemType !== 'audio' ? {
        transform: { x: 0, y: 0, width: '100%', height: '100%', rotation: 0, opacity: 1 },
      } : {}),
    };

    state.addItem(trackId, item);
    state.select([id]);
  } catch (err) {
    console.error('Drop failed:', err);
  }
}}
```

- [ ] **Step 3: Add drag data to AssetsPanel assets**

In AssetsPanel, on each uploaded asset's grid item, add draggable support:

```tsx
draggable
onDragStart={(e) => {
  e.dataTransfer.setData('application/x-project-asset', JSON.stringify({
    id: asset.id,
    url: asset.url,
    mimeType: asset.mimeType,
    filename: asset.filename,
    label: asset.label,
  }));
  e.dataTransfer.effectAllowed = 'copy';
}}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/timeline/TimelineCanvas.tsx apps/web/src/features/editor-v2/panels/AssetsPanel.tsx
git commit -m "feat(timeline): add drop zone for assets, make assets draggable"
```

---

### Task 6: Auto-switch properties panel on selection

**Files:**
- Modify: `apps/web/src/features/editor-v2/components/RightPanel.tsx`

- [ ] **Step 1: Read RightPanel.tsx**

Read the file to understand the tab switching mechanism and current tab state.

- [ ] **Step 2: Add effect to auto-switch tab on item selection**

Add a `useEffect` that watches `selectedIds` and auto-switches to the item-properties tab when an item is selected:

```tsx
const selectedIds = useSelectedIds();

useEffect(() => {
  if (selectedIds.length === 1) {
    // Auto-switch to item properties tab
    setActiveTab('item-properties');
  }
}, [selectedIds]);
```

Only auto-switch for single selection (not multi-select which might be for group operations).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor-v2/components/RightPanel.tsx
git commit -m "feat(editor): auto-switch to properties tab on item selection"
```

---

## Chunk 4: Extract shared helper

### Task 7: Extract findOrCreateTrack to shared util

**Files:**
- Create: `apps/web/src/features/editor-v2/utils/track-utils.ts`
- Modify: `apps/web/src/features/editor-v2/components/AddItemToolbar.tsx`
- Modify: `apps/web/src/features/editor-v2/panels/AssetsPanel.tsx`

- [ ] **Step 1: Create track-utils.ts**

```typescript
// apps/web/src/features/editor-v2/utils/track-utils.ts
import type { Track } from '../store/types';

const TRACK_NAMES: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  overlay: 'Overlay',
  caption: 'Caption',
};

export function findOrCreateTrack(
  tracks: Track[],
  trackType: string,
  addTrack: (track: Track) => void,
): string {
  const existing = tracks.find((t) => t.type === trackType);
  if (existing) return existing.id;

  const count = tracks.filter((t) => t.type === trackType).length;
  const name = `${TRACK_NAMES[trackType] || trackType} ${count + 1}`;
  const id = `track-${trackType}-${Date.now()}`;
  const newTrack: Track = {
    id,
    type: trackType as Track['type'],
    name,
    position: tracks.length,
    height: 60,
    locked: false,
    visible: true,
    collapsed: false,
  };
  addTrack(newTrack);
  return id;
}
```

- [ ] **Step 2: Update AddItemToolbar to use shared helper**

Replace the inline `findOrCreateTrack` with the import.

- [ ] **Step 3: Update AssetsPanel to use shared helper**

Replace the inline copy with the import.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor-v2/utils/track-utils.ts apps/web/src/features/editor-v2/components/AddItemToolbar.tsx apps/web/src/features/editor-v2/panels/AssetsPanel.tsx
git commit -m "refactor: extract findOrCreateTrack to shared util"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | AddItemToolbar component | New: AddItemToolbar.tsx |
| 2 | Mount toolbar in Editor | Modify: Editor.tsx |
| 3 | AssetsPanel extension | Modify: AssetsPanel.tsx |
| 4 | Track creation button | Modify: TrackHeaders.tsx |
| 5 | Timeline drop zone | Modify: TimelineCanvas.tsx, AssetsPanel.tsx |
| 6 | Properties auto-switch | Modify: RightPanel.tsx |
| 7 | Extract shared helper | New: track-utils.ts, modify toolbar + assets |
