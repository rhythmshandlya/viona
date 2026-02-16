# Phase 2: Positioning System Enhancement

## Overview

Upgrade the subtitle positioning system from basic top/center/bottom presets to a full spatial control system with X/Y sliders, rotation, and platform-specific safe zone awareness.

## Current State Analysis

### Existing Positioning Properties

| Property | Type | UI Control | Description |
|----------|------|------------|-------------|
| `position` | `'top' \| 'center' \| 'bottom'` | Segmented | Vertical anchor |
| `offsetY` | `number` | None exposed | Vertical offset from anchor |
| `textAlign` | `'left' \| 'center' \| 'right'` | None exposed | Text alignment |

### Competitor Capabilities

| Feature | CapCut | Captions | Descript | Current |
|---------|--------|----------|----------|---------|
| Vertical position | ✓ | ✓ | ✓ | ✓ (limited) |
| Horizontal position | ✓ | ✓ | ✓ | ✗ |
| Pixel-level X/Y | ✓ | ✓ | ✓ | ✗ |
| Rotation | ✓ | ✓ | ✓ | ✗ |
| Safe zone guides | ✓ | ✓ | ✓ | ✗ |
| Drag-and-drop | ✓ | ✓ | ✓ | ✗ |

### Identified Gaps

1. **No horizontal position control** - Can't move captions left/right
2. **No fine-grained vertical control** - Only 3 preset positions
3. **No rotation** - Can't angle text
4. **No safe zone awareness** - Easy to place captions where platform UI overlaps
5. **offsetY exists but no UI** - Hidden from users

---

## Phase 2a: Data Model Changes

### Updated Position Properties

```typescript
// In packages/shared/src/types/index.ts
// In apps/web/src/features/editor-v2/store/types.ts

interface CaptionStyle {
  // ... existing properties ...

  // UPDATED: Position system
  position: CaptionPosition;
}

interface CaptionPosition {
  // Anchor point (where the caption "attaches")
  anchor: 'top' | 'center' | 'bottom';

  // Offset from anchor (percentage of canvas)
  // X: -50 to +50 (0 = centered)
  // Y: -50 to +50 (0 = at anchor)
  offsetX: number;
  offsetY: number;

  // Rotation in degrees (-180 to +180)
  rotation: number;

  // Text alignment within caption box
  textAlign: 'left' | 'center' | 'right';
}

// Safe zone definitions for different platforms
interface SafeZone {
  top: number;      // % from top to avoid
  bottom: number;   // % from bottom to avoid
  left: number;     // % from left to avoid
  right: number;    // % from right to avoid
}

const PLATFORM_SAFE_ZONES: Record<string, SafeZone> = {
  'tiktok': { top: 15, bottom: 25, left: 5, right: 5 },
  'instagram-reels': { top: 12, bottom: 20, left: 5, right: 5 },
  'youtube-shorts': { top: 10, bottom: 18, left: 5, right: 5 },
  'universal': { top: 10, bottom: 15, left: 5, right: 5 },
};
```

### Migration from Legacy Format

```typescript
// Old format:
{
  position: 'bottom',
  offsetY: 0,
  textAlign: 'center',
}

// New format:
{
  position: {
    anchor: 'bottom',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    textAlign: 'center',
  }
}

function migratePosition(legacy: any): CaptionPosition {
  // If already new format
  if (typeof legacy.position === 'object') {
    return legacy.position;
  }

  // Migrate from old format
  return {
    anchor: legacy.position || 'bottom',
    offsetX: 0,
    offsetY: legacy.offsetY || 0,
    rotation: 0,
    textAlign: legacy.textAlign || 'center',
  };
}
```

### Default Values

```typescript
export const DEFAULT_CAPTION_POSITION: CaptionPosition = {
  anchor: 'bottom',
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  textAlign: 'center',
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  // ... existing ...
  position: DEFAULT_CAPTION_POSITION,
};
```

---

## Phase 2a: UI Changes

### StylePanel Updates

Location: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

Replace current Position segmented control with expanded section:

```
┌─────────────────────────────────────┐
│ POSITION                            │
├─────────────────────────────────────┤
│ Anchor        [ Top | Center | Bot ]│
│                                     │
│ Horizontal    [────●────────] 0%    │
│               ← Left    Right →     │
│                                     │
│ Vertical      [────●────────] 0%    │
│               ↑ Up        Down ↓    │
│                                     │
│ Rotation      [────●────────] 0°    │
│               -180°        +180°    │
│                                     │
│ Text Align    [ ≡L | ≡C | ≡R ]      │
├─────────────────────────────────────┤
│ Safe Zone     [TikTok          ▼]   │
│               ☑ Show guide overlay  │
└─────────────────────────────────────┘
```

### Control Specifications

#### Anchor Selector
- Segmented control: Top | Center | Bottom
- Determines the reference point for offsets
- Default: Bottom

#### Horizontal Offset (X)
- Range: -50 to +50 (percentage of canvas width)
- Step: 1
- Default: 0 (centered)
- Label shows: "-25%" / "0%" / "+25%"

#### Vertical Offset (Y)
- Range: -50 to +50 (percentage of canvas height)
- Step: 1
- Default: 0 (at anchor)
- Positive = away from anchor, Negative = toward center

#### Rotation
- Range: -180 to +180 degrees
- Step: 1 (hold Shift for 15° increments)
- Default: 0
- Display: "15°" / "-45°"

#### Text Alignment
- Segmented control: Left | Center | Right
- Icons: ≡ with alignment indicator
- Default: Center

#### Safe Zone Selector
- Dropdown: TikTok, Instagram Reels, YouTube Shorts, Universal, None
- Checkbox: "Show guide overlay"
- When enabled, shows semi-transparent overlay on preview

### Safe Zone Overlay Component

New component for video preview:

```typescript
interface SafeZoneOverlayProps {
  platform: string;
  visible: boolean;
}

function SafeZoneOverlay({ platform, visible }: SafeZoneOverlayProps) {
  if (!visible) return null;

  const zone = PLATFORM_SAFE_ZONES[platform];

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top danger zone */}
      <div
        className="absolute top-0 left-0 right-0 bg-red-500/20 border-b border-red-500/50"
        style={{ height: `${zone.top}%` }}
      />
      {/* Bottom danger zone */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-red-500/20 border-t border-red-500/50"
        style={{ height: `${zone.bottom}%` }}
      />
      {/* Safe area indicator */}
      <div
        className="absolute border-2 border-dashed border-green-500/50"
        style={{
          top: `${zone.top}%`,
          bottom: `${zone.bottom}%`,
          left: `${zone.left}%`,
          right: `${zone.right}%`,
        }}
      />
    </div>
  );
}
```

---

## Phase 2a: Client Rendering

### Composition.tsx Updates

Location: `apps/web/src/features/editor-v2/player/Composition.tsx`

Update position calculation in `CaptionRenderer`:

```typescript
function calculatePositionStyles(
  position: CaptionPosition,
  canvasWidth: number,
  canvasHeight: number
): React.CSSProperties {
  const { anchor, offsetX, offsetY, rotation, textAlign } = position;

  // Base position from anchor
  let top: string | undefined;
  let bottom: string | undefined;

  switch (anchor) {
    case 'top':
      top = `${10 + offsetY}%`;
      break;
    case 'center':
      top = `${50 + offsetY}%`;
      break;
    case 'bottom':
      bottom = `${15 - offsetY}%`;
      break;
  }

  // Horizontal position
  const left = `${50 + offsetX}%`;

  // Build transform
  const transforms: string[] = ['translateX(-50%)'];
  if (anchor === 'center') {
    transforms[0] = 'translate(-50%, -50%)';
  }
  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`);
  }

  return {
    position: 'absolute',
    left,
    top,
    bottom,
    transform: transforms.join(' '),
    textAlign,
    width: '90%',
    maxWidth: '90%',
  };
}
```

### Usage in CaptionRenderer:

```typescript
function CaptionRenderer({ item, fps }: CaptionRendererProps) {
  const data = item.data as CaptionItemData;
  const style = data.style;

  // Migrate position if needed
  const position = typeof style.position === 'object'
    ? style.position
    : migratePosition(style);

  const positionStyles = calculatePositionStyles(
    position,
    1080,  // canvas width
    1920   // canvas height
  );

  // ... rest of rendering
}
```

---

## Phase 2b: Server Rendering (Remotion)

### AnimatedSubtitle.tsx Updates

Location: `packages/renderer/src/components/AnimatedSubtitle.tsx`

#### Update SubtitleStyle interface:

```typescript
export interface SubtitlePosition {
  anchor: 'top' | 'center' | 'bottom';
  offsetX: number;
  offsetY: number;
  rotation: number;
  textAlign: 'left' | 'center' | 'right';
}

export interface SubtitleStyle {
  // ... existing ...
  position?: SubtitlePosition | 'top' | 'center' | 'bottom';  // Support both formats
}
```

#### Add position calculation:

```typescript
function resolvePosition(
  position: SubtitlePosition | 'top' | 'center' | 'bottom' | undefined
): SubtitlePosition {
  if (!position) {
    return { anchor: 'bottom', offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center' };
  }
  if (typeof position === 'string') {
    return { anchor: position, offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center' };
  }
  return position;
}

// In AnimatedSubtitle component:
const resolvedPosition = resolvePosition(style.position);
const positionStyles = calculatePositionStyles(resolvedPosition);
```

---

## Phase 2b: Editor State Updates

### Store Changes

Location: `apps/web/src/features/editor-v2/store/editor-store.ts`

Add safe zone state:

```typescript
interface EditorState {
  // ... existing ...

  // Safe zone settings
  safeZonePlatform: string;  // 'tiktok' | 'instagram-reels' | etc.
  showSafeZone: boolean;
}

interface EditorActions {
  // ... existing ...

  setSafeZonePlatform: (platform: string) => void;
  setShowSafeZone: (show: boolean) => void;
}
```

---

## Preset Updates

### Update SubtitlePreset interface

```typescript
export interface SubtitlePreset {
  // ... existing ...

  // REPLACE old position fields with new structure
  position: CaptionPosition;
}
```

### Update existing presets

```typescript
'mrbeast-bold': {
  // ... existing ...
  position: {
    anchor: 'bottom',
    offsetX: 0,
    offsetY: 5,  // Slightly higher than default
    rotation: 0,
    textAlign: 'center',
  },
},

'hormozi': {
  // ... existing ...
  position: {
    anchor: 'center',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    textAlign: 'center',
  },
},

'cinema-fade': {
  // ... existing ...
  position: {
    anchor: 'bottom',
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    textAlign: 'center',
  },
},
```

---

## Testing Checklist

### Unit Tests
- [ ] Position migration converts legacy format correctly
- [ ] Default values applied when position missing
- [ ] Rotation transforms calculated correctly
- [ ] Safe zone percentages correct for each platform

### Integration Tests
- [ ] X offset slider moves caption horizontally
- [ ] Y offset slider moves caption vertically
- [ ] Rotation slider rotates caption
- [ ] Anchor change repositions caption correctly
- [ ] Safe zone overlay appears/disappears
- [ ] Apply to all works with position changes

### Render Parity Tests
- [ ] Export video with X offset at -25%
- [ ] Export video with Y offset at +10%
- [ ] Export video with rotation at 15°
- [ ] Export video with combined X, Y, rotation
- [ ] Compare client preview to exported frame

### Edge Cases
- [ ] Rotation near edges doesn't clip text
- [ ] Extreme offsets stay within canvas
- [ ] Text alignment works with rotation

---

## Files to Modify

### Phase 2a (Client)

| File | Changes |
|------|---------|
| `packages/shared/src/types/index.ts` | Add `CaptionPosition`, `SafeZone`, update types |
| `apps/web/src/features/editor-v2/store/types.ts` | Update `CaptionStyle`, add safe zone state |
| `apps/web/src/features/editor-v2/store/editor-store.ts` | Add safe zone actions |
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | Replace position section with full controls |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Update position calculation |
| `apps/web/src/features/editor-v2/components/SafeZoneOverlay.tsx` | New component |
| `apps/web/src/lib/subtitle-presets.ts` | Update preset position format |

### Phase 2b (Server)

| File | Changes |
|------|---------|
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Add position types, calculation |

---

## Backward Compatibility

1. **Legacy position string**: Detected and migrated automatically
   - `'bottom'` → `{ anchor: 'bottom', offsetX: 0, offsetY: 0, rotation: 0, textAlign: 'center' }`

2. **Missing offsetY**: Defaults to 0

3. **Missing textAlign**: Defaults to 'center'

4. **Existing projects**: Render identically (migration preserves current appearance)

---

## Success Criteria

1. User can move captions horizontally with X offset slider
2. User can move captions vertically with Y offset slider
3. User can rotate captions with rotation slider
4. User can select platform-specific safe zones
5. Safe zone overlay visually shows danger areas
6. Exported video matches client preview for all position settings
7. Existing projects render identically after update

---

## Future Considerations (Not in this phase)

- **Drag-and-drop positioning** - Could add in Phase 5 (UI/UX)
- **Keyframe animation for position** - Would require Phase 4 animation system
- **Per-word positioning** - Complex, deferred

---

## Estimated Scope

- **Type changes**: ~50 lines
- **UI changes**: ~200 lines (StylePanel + SafeZoneOverlay)
- **Client render**: ~50 lines
- **Server render**: ~40 lines
- **Store changes**: ~20 lines
- **Presets**: ~40 lines
- **Total**: ~400 lines of changes
