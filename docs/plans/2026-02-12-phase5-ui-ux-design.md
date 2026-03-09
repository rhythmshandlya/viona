# Phase 5: UI/UX Improvements

## Overview

Enhance the caption editing experience with better preset previews, keyboard shortcuts, batch editing, and workflow improvements. This phase focuses on the editor interface without render pipeline changes.

## Current State Analysis

### Existing UI

| Feature | Current State |
|---------|---------------|
| Preset selection | 2-column grid with "Hello" text preview |
| Preset preview | Static, shows only activeColor + shadow |
| Style panel | Collapsible "Customize" section |
| Keyboard shortcuts | None for caption editing |
| Batch editing | "Apply to all" toggle only |
| Timeline integration | Basic caption blocks |
| Animation preview | Must play video to see |

### Competitor Capabilities

| Feature | CapCut | Captions | Descript | Current |
|---------|--------|----------|----------|---------|
| Visual preset gallery | ✓ | ✓ | ✓ | Basic |
| Animated preset preview | ✓ | - | - | ✗ |
| Keyboard shortcuts | ✓ | ✓ | ✓ | ✗ |
| Batch style editing | ✓ | ✓ | ✓ | Limited |
| Waveform visualization | ✓ | - | ✓ | ✗ |
| Real-time preview | ✓ | ✓ | ✓ | ✓ |
| Style search/filter | ✓ | - | - | ✗ |

### Identified Gaps

1. **Poor preset previews** - Static "Hello" doesn't show animation or full style
2. **No keyboard shortcuts** - Slow workflow for power users
3. **Limited batch editing** - Can't select multiple captions easily
4. **No waveform** - Hard to sync captions with speech
5. **No animation preview** - Must play video to see effect
6. **No style search** - Hard to find presets as library grows

---

## Phase 5: Improvements

### 5.1 Enhanced Preset Gallery

#### Animated Preset Previews

Replace static "Hello" with animated mini-preview:

```
┌─────────────────────────────────────┐
│ PRESETS                             │
├─────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐         │
│ │  ┌─────┐  │ │  ┌─────┐  │         │
│ │  │Hello│  │ │  │Hello│  │  ← Animated
│ │  └─────┘  │ │  └─────┘  │    preview
│ │ MrBeast   │ │ Hormozi   │         │
│ │ ● ● ○ ○ ○ │ │ ● ● ● ○ ○ │  ← Style dots
│ └───────────┘ └───────────┘         │
│ ┌───────────┐ ┌───────────┐         │
│ │  ...      │ │  ...      │         │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
interface PresetPreviewProps {
  preset: SubtitlePreset;
  isSelected: boolean;
  onClick: () => void;
}

function PresetPreview({ preset, isSelected, onClick }: PresetPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'p-3 rounded-lg border transition-all',
        isSelected ? 'border-accent bg-accent/10' : 'border-subtle'
      )}
    >
      {/* Mini animated preview */}
      <div className="h-12 flex items-center justify-center overflow-hidden">
        <AnimatedPreviewWord
          text="Hello"
          preset={preset}
          animate={isHovered}  // Animate on hover
        />
      </div>

      {/* Preset name */}
      <div className="text-xs text-secondary mt-2">{preset.name}</div>

      {/* Style indicators */}
      <StyleIndicators preset={preset} />
    </button>
  );
}
```

#### Style Indicator Dots

Show quick visual summary of preset features:

```typescript
function StyleIndicators({ preset }: { preset: SubtitlePreset }) {
  return (
    <div className="flex gap-1 mt-1">
      {/* Animation indicator */}
      {preset.animation.in !== 'none' && (
        <span className="w-2 h-2 rounded-full bg-purple-500" title="Animated" />
      )}
      {/* Glow indicator */}
      {preset.effects?.glow?.enabled && (
        <span className="w-2 h-2 rounded-full bg-cyan-500" title="Glow" />
      )}
      {/* Stroke indicator */}
      {preset.stroke && (
        <span className="w-2 h-2 rounded-full bg-orange-500" title="Stroke" />
      )}
      {/* Karaoke indicator */}
      {preset.displayMode === 'karaoke' && (
        <span className="w-2 h-2 rounded-full bg-green-500" title="Karaoke" />
      )}
    </div>
  );
}
```

#### Preset Search & Filter

Add search bar above preset grid:

```
┌─────────────────────────────────────┐
│ 🔍 Search presets...                │
├─────────────────────────────────────┤
│ Filter: [All] [Animated] [Glow]     │
│         [Karaoke] [Minimal]         │
├─────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐         │
│ │  ...      │ │  ...      │         │
```

```typescript
function PresetSearch({ onSearch, onFilter }: PresetSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);

  const filterOptions = [
    { id: 'animated', label: 'Animated' },
    { id: 'glow', label: 'Glow' },
    { id: 'karaoke', label: 'Karaoke' },
    { id: 'minimal', label: 'Minimal' },
  ];

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search presets..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        className="w-full px-3 py-2 rounded-md bg-elevated"
      />
      <div className="flex flex-wrap gap-1">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggleFilter(opt.id)}
            className={cn(
              'px-2 py-1 text-xs rounded',
              filters.includes(opt.id) ? 'bg-accent' : 'bg-elevated'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### 5.2 Keyboard Shortcuts

#### Caption Editing Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + A` | Select all captions |
| `Cmd/Ctrl + D` | Duplicate selected captions |
| `Delete` / `Backspace` | Delete selected captions |
| `[` | Trim caption start to playhead |
| `]` | Trim caption end to playhead |
| `Cmd/Ctrl + M` | Merge selected captions |
| `Cmd/Ctrl + Shift + S` | Split caption at playhead |
| `Tab` | Select next caption |
| `Shift + Tab` | Select previous caption |
| `↑` / `↓` | Nudge caption timing (±100ms) |
| `Shift + ↑/↓` | Nudge timing (±10ms fine) |

#### Style Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Toggle bold on selected word |
| `Cmd/Ctrl + 1-9` | Apply preset 1-9 |
| `Cmd/Ctrl + 0` | Reset to default style |
| `Cmd/Ctrl + Shift + C` | Copy style |
| `Cmd/Ctrl + Shift + V` | Paste style |

#### Implementation

```typescript
// hooks/use-caption-shortcuts.ts
export function useCaptionShortcuts() {
  const {
    selectedIds,
    selectAll,
    deleteItems,
    duplicateItems,
    mergeCaptions,
    splitCaption,
    nudgeItems,
    trimItems,
  } = useEditorActions();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Select all
      if (isMod && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        e.preventDefault();
        deleteItems(selectedIds);
      }

      // Duplicate
      if (isMod && e.key === 'd') {
        e.preventDefault();
        duplicateItems(selectedIds);
      }

      // Merge
      if (isMod && e.key === 'm' && selectedIds.length >= 2) {
        e.preventDefault();
        mergeCaptions(selectedIds[0], selectedIds[1]);
      }

      // Trim to playhead
      if (e.key === '[') {
        e.preventDefault();
        trimItems(selectedIds, 'start', currentTimeMs);
      }
      if (e.key === ']') {
        e.preventDefault();
        trimItems(selectedIds, 'end', currentTimeMs);
      }

      // Nudge timing
      if (e.key === 'ArrowUp' && selectedIds.length) {
        e.preventDefault();
        const delta = e.shiftKey ? -10 : -100;
        nudgeItems(selectedIds, delta);
      }
      if (e.key === 'ArrowDown' && selectedIds.length) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 100;
        nudgeItems(selectedIds, delta);
      }

      // Apply preset (Cmd+1 through Cmd+9)
      if (isMod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const presetIndex = parseInt(e.key) - 1;
        applyPresetByIndex(presetIndex);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, currentTimeMs]);
}
```

#### Keyboard Shortcut Help Panel

```
┌─────────────────────────────────────┐
│ KEYBOARD SHORTCUTS              ?   │
├─────────────────────────────────────┤
│ Selection                           │
│ ⌘A      Select all captions         │
│ Tab     Next caption                │
│ ⇧Tab    Previous caption            │
│                                     │
│ Editing                             │
│ ⌘D      Duplicate                   │
│ ⌘M      Merge captions              │
│ ⌘⇧S     Split at playhead           │
│ Del     Delete selected             │
│                                     │
│ Timing                              │
│ [       Trim start to playhead      │
│ ]       Trim end to playhead        │
│ ↑/↓     Nudge ±100ms                │
│ ⇧↑/↓    Nudge ±10ms (fine)          │
│                                     │
│ Styles                              │
│ ⌘1-9    Apply preset                │
│ ⌘0      Reset style                 │
│ ⌘⇧C     Copy style                  │
│ ⌘⇧V     Paste style                 │
└─────────────────────────────────────┘
```

---

### 5.3 Batch Editing Improvements

#### Multi-Select in Timeline

Enable shift-click and drag-select for captions:

```typescript
// Timeline selection improvements
function handleCaptionClick(captionId: string, e: React.MouseEvent) {
  if (e.shiftKey && lastSelectedId) {
    // Range select: select all between last and current
    selectRange(lastSelectedId, captionId);
  } else if (e.metaKey || e.ctrlKey) {
    // Toggle select: add/remove from selection
    select([captionId], 'toggle');
  } else {
    // Single select
    select([captionId], 'replace');
  }
}

// Drag-select box
function handleSelectionBox(box: SelectionBox) {
  const captionsInBox = getCaptionsInRect(box);
  select(captionsInBox.map(c => c.id), 'replace');
}
```

#### Batch Style Operations

Add batch operations toolbar when multiple selected:

```
┌─────────────────────────────────────┐
│ 3 captions selected                 │
├─────────────────────────────────────┤
│ [Apply Preset ▼] [Copy Style]       │
│ [Reset] [Merge] [Delete]            │
└─────────────────────────────────────┘
```

```typescript
function BatchActionsToolbar({ selectedCount }: { selectedCount: number }) {
  if (selectedCount < 2) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-elevated rounded-lg">
      <span className="text-sm text-secondary">
        {selectedCount} captions selected
      </span>
      <div className="flex gap-1">
        <PresetDropdown onSelect={applyPresetToSelected} />
        <Button size="sm" onClick={copyStyleFromFirst}>Copy Style</Button>
        <Button size="sm" onClick={resetSelected}>Reset</Button>
        <Button size="sm" onClick={mergeSelected}>Merge</Button>
        <Button size="sm" variant="destructive" onClick={deleteSelected}>
          Delete
        </Button>
      </div>
    </div>
  );
}
```

---

### 5.4 Waveform Visualization

#### Audio Waveform in Timeline

Show audio waveform behind caption track for alignment:

```
┌─────────────────────────────────────────────────┐
│ Captions Track                                  │
│ ┌─────────┐     ┌──────────────┐   ┌──────┐    │
│ │ Hello   │     │ this is a    │   │ test │    │
│ └─────────┘     └──────────────┘   └──────┘    │
│ ▁▂▃▅▇█▇▅▃▂▁▁▁▁▂▃▅▇█████▇▅▃▂▁▁▁▂▃▅▇█▇▅▃▂▁      │ ← Waveform
└─────────────────────────────────────────────────┘
```

```typescript
interface WaveformProps {
  audioSrc: string;
  durationMs: number;
  zoom: number;
}

function Waveform({ audioSrc, durationMs, zoom }: WaveformProps) {
  const [waveformData, setWaveformData] = useState<number[]>([]);

  useEffect(() => {
    // Generate waveform data from audio
    generateWaveform(audioSrc).then(setWaveformData);
  }, [audioSrc]);

  const width = (durationMs / 1000) * zoom;

  return (
    <div
      className="absolute bottom-0 left-0 h-8 opacity-30 pointer-events-none"
      style={{ width }}
    >
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <path
          d={waveformToPath(waveformData)}
          fill="currentColor"
          className="text-blue-500"
        />
      </svg>
    </div>
  );
}

// Generate waveform from audio using Web Audio API
async function generateWaveform(src: string): Promise<number[]> {
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const rawData = audioBuffer.getChannelData(0);
  const samples = 1000;  // Number of points
  const blockSize = Math.floor(rawData.length / samples);

  const waveform: number[] = [];
  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[i * blockSize + j]);
    }
    waveform.push(sum / blockSize);
  }

  // Normalize to 0-1
  const max = Math.max(...waveform);
  return waveform.map(v => v / max);
}
```

#### Snap to Waveform Peaks

Option to snap caption edges to audio peaks:

```typescript
function findNearestPeak(timeMs: number, waveformData: number[], threshold = 0.7): number {
  const sampleRate = waveformData.length / durationMs;
  const sampleIndex = Math.floor(timeMs * sampleRate);

  // Search nearby for peak above threshold
  const searchRange = 50;  // ±50 samples
  for (let offset = 0; offset < searchRange; offset++) {
    for (const dir of [1, -1]) {
      const idx = sampleIndex + (offset * dir);
      if (idx >= 0 && idx < waveformData.length && waveformData[idx] > threshold) {
        return idx / sampleRate;
      }
    }
  }

  return timeMs;  // No peak found, return original
}
```

---

### 5.5 Animation Preview

#### Hover Preview in Preset Gallery

Already covered in 5.1 - presets animate on hover.

#### Animation Preview Button

Add preview button next to animation dropdown:

```
┌─────────────────────────────────────┐
│ In Animation                        │
│ [elastic-pop              ▼] [▶ ↻]  │
│                              ↑      │
│                      Preview button │
└─────────────────────────────────────┘
```

```typescript
function AnimationPreviewButton({ animation }: { animation: AnimationType }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleClick = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 500);  // Reset after animation
  };

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded hover:bg-elevated"
      title="Preview animation"
    >
      <RefreshCw className={cn('w-4 h-4', isPlaying && 'animate-spin')} />
    </button>
  );
}
```

#### Mini Preview Window

Small preview showing animation with current style:

```typescript
function AnimationMiniPreview({
  animation,
  style,
  isPlaying,
}: AnimationMiniPreviewProps) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      setKey(k => k + 1);  // Force re-render to restart animation
    }
  }, [isPlaying]);

  return (
    <div className="w-full h-16 bg-black/50 rounded flex items-center justify-center overflow-hidden">
      <AnimatedWord
        key={key}
        text="Preview"
        style={style}
        animation={animation}
        autoPlay={isPlaying}
      />
    </div>
  );
}
```

---

### 5.6 Style Panel Reorganization

#### Collapsible Sections with Memory

Remember which sections user has expanded:

```typescript
function StylePanel() {
  // Persist expanded state in localStorage
  const [expandedSections, setExpandedSections] = useLocalStorage(
    'style-panel-sections',
    ['presets', 'position']  // Default expanded
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className="flex flex-col">
      <CollapsibleSection
        title="Presets"
        expanded={expandedSections.includes('presets')}
        onToggle={() => toggleSection('presets')}
      >
        <PresetGallery />
      </CollapsibleSection>

      <CollapsibleSection
        title="Typography"
        expanded={expandedSections.includes('typography')}
        onToggle={() => toggleSection('typography')}
      >
        <TypographyControls />
      </CollapsibleSection>

      {/* ... other sections */}
    </div>
  );
}
```

#### Quick Actions Bar

Sticky bar at top of panel:

```
┌─────────────────────────────────────┐
│ [↩ Reset] [📋 Copy] [📄 Paste] [?]  │
├─────────────────────────────────────┤
│ PRESETS                          ▼  │
│ ...                                 │
```

---

## Testing Checklist

### Preset Gallery
- [ ] Presets animate on hover
- [ ] Style indicator dots show correct features
- [ ] Search filters presets by name
- [ ] Filter buttons work correctly
- [ ] Selected preset highlighted

### Keyboard Shortcuts
- [ ] All shortcuts work as documented
- [ ] Shortcuts don't conflict with browser
- [ ] Help panel shows all shortcuts
- [ ] Shortcuts disabled when typing in input

### Batch Editing
- [ ] Shift-click selects range
- [ ] Cmd/Ctrl-click toggles selection
- [ ] Drag-select box works
- [ ] Batch toolbar appears for multiple selection
- [ ] Batch operations apply to all selected

### Waveform
- [ ] Waveform generates from audio
- [ ] Waveform displays behind captions
- [ ] Snap to peaks works
- [ ] Performance acceptable with long audio

### Animation Preview
- [ ] Preview button triggers animation
- [ ] Mini preview shows current style
- [ ] Preview resets after animation completes

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | Reorganize, add sections |
| `apps/web/src/features/editor-v2/panels/PresetGallery.tsx` | New: animated previews, search, filters |
| `apps/web/src/features/editor-v2/panels/AnimationMiniPreview.tsx` | New: preview component |
| `apps/web/src/features/editor-v2/hooks/use-caption-shortcuts.ts` | New: keyboard shortcuts |
| `apps/web/src/features/editor-v2/components/KeyboardShortcutsHelp.tsx` | New: help panel |
| `apps/web/src/features/editor-v2/components/BatchActionsToolbar.tsx` | New: batch operations |
| `apps/web/src/features/editor-v2/timeline/Waveform.tsx` | New: waveform visualization |
| `apps/web/src/features/editor-v2/timeline/CaptionTrack.tsx` | Add waveform, improve selection |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Add batch actions, waveform state |
| `apps/web/src/lib/waveform-utils.ts` | New: waveform generation |

---

## Success Criteria

1. Presets animate on hover showing actual effect
2. Style indicator dots provide quick feature summary
3. Search and filter help find presets quickly
4. All keyboard shortcuts work reliably
5. Batch selection and editing works smoothly
6. Waveform helps align captions to speech
7. Animation preview shows effect without playing video
8. Panel sections remember expanded state

---

## Estimated Scope

- **Preset gallery**: ~300 lines
- **Keyboard shortcuts**: ~150 lines
- **Batch editing**: ~200 lines
- **Waveform**: ~250 lines
- **Animation preview**: ~100 lines
- **Panel reorganization**: ~100 lines
- **Total**: ~1100 lines of changes

---

## Note

This phase is **client-only** - no server/render changes needed. All improvements are in the editor UI.
