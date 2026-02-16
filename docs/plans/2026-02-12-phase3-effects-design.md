# Phase 3: Effects System Enhancement

## Overview

Upgrade the subtitle effects system from basic text shadow presets to a full effects system with custom shadows, glow effects, and multiple shadow support. This brings visual polish capabilities on par with CapCut and professional editing tools.

## Current State Analysis

### Existing Effects Properties

| Property | Type | UI Control | Description |
|----------|------|------------|-------------|
| `textShadow` | `string` | 3 presets (None/Soft/Hard) | CSS text-shadow string |
| `textStroke` | `string` | None | Dead code (being replaced in Phase 1) |

### Competitor Capabilities

| Feature | CapCut | Captions | Descript | Current |
|---------|--------|----------|----------|---------|
| Drop shadow | ✓ | ✓ | ✓ | ✓ (presets only) |
| Shadow blur control | ✓ | ✓ | ✓ | ✗ |
| Shadow offset X/Y | ✓ | ✓ | ✓ | ✗ |
| Shadow color | ✓ | ✓ | ✓ | ✗ |
| Shadow opacity | ✓ | ✓ | ✓ | ✗ |
| Glow effect | ✓ | - | - | ✗ |
| Multiple shadows | ✓ | - | - | ✗ |

### Identified Gaps

1. **No shadow customization** - Only 3 hardcoded presets
2. **No glow effect** - Popular for viral/neon styles
3. **No shadow color control** - Always black
4. **No blur/offset control** - Can't fine-tune shadow appearance
5. **Single shadow only** - Can't layer multiple effects

---

## Phase 3a: Data Model Changes

### New Effects Types

```typescript
// In packages/shared/src/types/index.ts
// In apps/web/src/features/editor-v2/store/types.ts

// Individual shadow definition
interface ShadowEffect {
  offsetX: number;    // -20 to +20 px
  offsetY: number;    // -20 to +20 px
  blur: number;       // 0 to 30 px
  color: string;      // hex color
  opacity: number;    // 0 to 1
}

// Glow effect (rendered as layered shadows)
interface GlowEffect {
  enabled: boolean;
  color: string;      // hex color
  intensity: number;  // 0 to 1 (affects opacity)
  size: number;       // 5 to 50 px (blur radius)
}

// Complete effects configuration
interface CaptionEffects {
  // Primary shadow (most common use case)
  shadow: ShadowEffect | null;

  // Optional secondary shadow (for depth)
  shadowSecondary: ShadowEffect | null;

  // Glow effect (renders as multiple blurred shadows)
  glow: GlowEffect | null;
}

interface CaptionStyle {
  // ... existing properties ...

  // REPLACE textShadow string with structured effects
  effects: CaptionEffects;

  // DEPRECATED: textShadow (migrated to effects.shadow)
  // textShadow?: string;
}
```

### Migration from Legacy Format

```typescript
// Old format:
{
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
}

// New format:
{
  effects: {
    shadow: { offsetX: 2, offsetY: 2, blur: 4, color: '#000000', opacity: 0.8 },
    shadowSecondary: null,
    glow: null,
  }
}

function migrateTextShadow(legacy: string | undefined): CaptionEffects {
  if (!legacy) {
    return { shadow: null, shadowSecondary: null, glow: null };
  }

  // Parse "2px 2px 4px rgba(0, 0, 0, 0.8)" format
  const match = legacy.match(
    /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  );

  if (!match) {
    // Fallback for other formats
    return {
      shadow: { offsetX: 2, offsetY: 2, blur: 4, color: '#000000', opacity: 0.8 },
      shadowSecondary: null,
      glow: null,
    };
  }

  const [, x, y, blur, r, g, b, a] = match;
  const color = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;

  return {
    shadow: {
      offsetX: parseInt(x),
      offsetY: parseInt(y),
      blur: parseInt(blur),
      color,
      opacity: a ? parseFloat(a) : 1,
    },
    shadowSecondary: null,
    glow: null,
  };
}
```

### Default Values

```typescript
export const DEFAULT_SHADOW: ShadowEffect = {
  offsetX: 2,
  offsetY: 2,
  blur: 4,
  color: '#000000',
  opacity: 0.8,
};

export const DEFAULT_GLOW: GlowEffect = {
  enabled: false,
  color: '#00ffff',
  intensity: 0.7,
  size: 20,
};

export const DEFAULT_CAPTION_EFFECTS: CaptionEffects = {
  shadow: DEFAULT_SHADOW,
  shadowSecondary: null,
  glow: null,
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  // ... existing ...
  effects: DEFAULT_CAPTION_EFFECTS,
};
```

---

## Phase 3a: UI Changes

### StylePanel Updates

Location: `apps/web/src/features/editor-v2/panels/StylePanel.tsx`

Replace the limited "Text Shadow" segmented control with a full effects section:

```
┌─────────────────────────────────────┐
│ EFFECTS                          ▼  │
├─────────────────────────────────────┤
│ Shadow          [● On]              │
│ ┌─────────────────────────────────┐ │
│ │ Offset X    [────●────] 2px     │ │
│ │ Offset Y    [────●────] 2px     │ │
│ │ Blur        [──●──────] 4px     │ │
│ │ Color       [■] #000000         │ │
│ │ Opacity     [──────●──] 80%     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Second Shadow   [○ Off]             │
│ (controls appear when enabled)      │
│                                     │
├─────────────────────────────────────┤
│ Glow            [○ Off]             │
│ ┌─────────────────────────────────┐ │
│ │ Color       [■] #00ffff         │ │
│ │ Intensity   [────●────] 70%     │ │
│ │ Size        [───●─────] 20px    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Control Specifications

#### Shadow Controls (Primary)

| Control | Range | Step | Default |
|---------|-------|------|---------|
| Toggle | On/Off | - | On |
| Offset X | -20 to +20 px | 1 | 2 |
| Offset Y | -20 to +20 px | 1 | 2 |
| Blur | 0 to 30 px | 1 | 4 |
| Color | Color picker | - | #000000 |
| Opacity | 0-100% | 1 | 80% |

#### Shadow Controls (Secondary)
- Same controls as primary
- Default: Off
- When enabled, same defaults as primary but offset by +1px

#### Glow Controls

| Control | Range | Step | Default |
|---------|-------|------|---------|
| Toggle | On/Off | - | Off |
| Color | Color picker | - | #00ffff (cyan) |
| Intensity | 0-100% | 1 | 70% |
| Size | 5 to 50 px | 1 | 20 |

### Quick Presets (Optional Enhancement)

Add preset buttons above custom controls:

```
┌─────────────────────────────────────┐
│ EFFECTS                             │
├─────────────────────────────────────┤
│ Quick:  [None][Soft][Hard][Neon]    │
├─────────────────────────────────────┤
│ Shadow          [● On]              │
│ ...                                 │
```

Preset definitions:
- **None**: shadow: null, glow: null
- **Soft**: shadow with blur 6, opacity 0.5
- **Hard**: shadow with blur 0, opacity 0.9
- **Neon**: glow enabled with intensity 0.8

---

## Phase 3a: Client Rendering

### Effects to CSS Conversion

```typescript
function effectsToCss(effects: CaptionEffects): React.CSSProperties {
  const shadows: string[] = [];

  // Primary shadow
  if (effects.shadow) {
    const { offsetX, offsetY, blur, color, opacity } = effects.shadow;
    shadows.push(`${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`);
  }

  // Secondary shadow
  if (effects.shadowSecondary) {
    const { offsetX, offsetY, blur, color, opacity } = effects.shadowSecondary;
    shadows.push(`${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`);
  }

  // Glow effect (rendered as multiple layered shadows)
  if (effects.glow?.enabled) {
    const { color, intensity, size } = effects.glow;
    const rgb = hexToRgb(color);
    // Layer 1: tight glow
    shadows.push(`0 0 ${size * 0.3}px rgba(${rgb}, ${intensity})`);
    // Layer 2: medium glow
    shadows.push(`0 0 ${size * 0.6}px rgba(${rgb}, ${intensity * 0.7})`);
    // Layer 3: wide glow
    shadows.push(`0 0 ${size}px rgba(${rgb}, ${intensity * 0.4})`);
  }

  return {
    textShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
  };
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
```

### Composition.tsx Updates

Location: `apps/web/src/features/editor-v2/player/Composition.tsx`

```typescript
function CaptionRenderer({ item, fps }: CaptionRendererProps) {
  const data = item.data as CaptionItemData;
  const style = data.style;

  // Migrate effects if needed
  const effects = style.effects ?? migrateTextShadow(style.textShadow);

  // Convert to CSS
  const effectsCss = effectsToCss(effects);

  // Apply to word styles
  const wordStyle: React.CSSProperties = {
    // ... existing ...
    ...effectsCss,  // Applies textShadow
  };
}
```

---

## Phase 3b: Server Rendering (Remotion)

### AnimatedSubtitle.tsx Updates

Location: `packages/renderer/src/components/AnimatedSubtitle.tsx`

#### Update SubtitleStyle interface:

```typescript
export interface ShadowEffect {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface GlowEffect {
  enabled: boolean;
  color: string;
  intensity: number;
  size: number;
}

export interface SubtitleEffects {
  shadow: ShadowEffect | null;
  shadowSecondary: ShadowEffect | null;
  glow: GlowEffect | null;
}

export interface SubtitleStyle {
  // ... existing ...
  effects?: SubtitleEffects;
  textShadow?: string;  // Legacy support
}
```

#### Add effects conversion (same function):

```typescript
// Reuse effectsToCss function from client
// Or import from shared package

const Word: React.FC<WordProps> = ({ word, style, currentTimeMs }) => {
  // Resolve effects
  const effects = style.effects ?? migrateTextShadow(style.textShadow);
  const effectsCss = effectsToCss(effects);

  const wordCss: React.CSSProperties = {
    // ... existing ...
    ...effectsCss,
  };

  return <span style={wordCss}>{word.text}</span>;
};
```

---

## Preset Updates

### Update SubtitlePreset interface

```typescript
export interface SubtitlePreset {
  // ... existing ...

  // REPLACE textShadow with effects
  effects: CaptionEffects;
}
```

### Update existing presets

```typescript
'mrbeast-bold': {
  // ... existing ...
  effects: {
    shadow: { offsetX: 3, offsetY: 3, blur: 6, color: '#000000', opacity: 0.9 },
    shadowSecondary: null,
    glow: null,
  },
},

'neon-karaoke': {
  // ... existing ...
  effects: {
    shadow: null,
    shadowSecondary: null,
    glow: { enabled: true, color: '#00ffff', intensity: 0.8, size: 30 },
  },
},

'glitch-out': {
  // ... existing ...
  effects: {
    shadow: { offsetX: 2, offsetY: 0, blur: 0, color: '#ff0000', opacity: 1 },
    shadowSecondary: { offsetX: -2, offsetY: 0, blur: 0, color: '#00ffff', opacity: 1 },
    glow: null,
  },
},

'cinema-fade': {
  // ... existing ...
  effects: {
    shadow: { offsetX: 1, offsetY: 1, blur: 3, color: '#000000', opacity: 0.6 },
    shadowSecondary: null,
    glow: null,
  },
},

'minimal': {
  // ... existing ...
  effects: {
    shadow: { offsetX: 1, offsetY: 1, blur: 2, color: '#000000', opacity: 0.5 },
    shadowSecondary: null,
    glow: null,
  },
},
```

---

## Testing Checklist

### Unit Tests
- [ ] Migration converts legacy textShadow strings correctly
- [ ] effectsToCss generates valid CSS
- [ ] Glow layers render correctly
- [ ] Multiple shadows combine properly
- [ ] hexToRgb conversion works

### Integration Tests
- [ ] Shadow toggle enables/disables shadow
- [ ] Shadow offset sliders affect position
- [ ] Shadow blur slider affects blur radius
- [ ] Shadow color picker works
- [ ] Shadow opacity slider affects transparency
- [ ] Secondary shadow toggle and controls work
- [ ] Glow toggle enables/disables glow
- [ ] Glow controls affect appearance
- [ ] Quick presets apply correctly

### Render Parity Tests
- [ ] Export video with custom shadow (offset 5, 5, blur 10)
- [ ] Export video with shadow + glow
- [ ] Export video with two shadows (glitch effect)
- [ ] Export video with glow only (no shadow)
- [ ] Compare client preview to exported frame

### Visual Quality Tests
- [ ] Glow looks smooth (no banding)
- [ ] Shadow edges are clean
- [ ] Multiple shadows blend naturally

---

## Files to Modify

### Phase 3a (Client)

| File | Changes |
|------|---------|
| `packages/shared/src/types/index.ts` | Add `ShadowEffect`, `GlowEffect`, `CaptionEffects` |
| `apps/web/src/features/editor-v2/store/types.ts` | Update `CaptionStyle`, defaults |
| `apps/web/src/features/editor-v2/panels/StylePanel.tsx` | New effects section with all controls |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Add effectsToCss, apply to rendering |
| `apps/web/src/lib/subtitle-presets.ts` | Update preset effects format |
| `apps/web/src/lib/effects-utils.ts` | New file: effectsToCss, hexToRgb, migration |

### Phase 3b (Server)

| File | Changes |
|------|---------|
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Add effect types, effectsToCss |

### Shared (Optional)

| File | Changes |
|------|---------|
| `packages/shared/src/effects.ts` | New file: shared effectsToCss if desired |

---

## Backward Compatibility

1. **Legacy textShadow string**: Detected and migrated automatically
   - `'2px 2px 4px rgba(0,0,0,0.8)'` → structured `ShadowEffect`

2. **Missing effects**: Defaults applied (shadow on, glow off)

3. **Existing projects**: Render identically (migration preserves appearance)

---

## Success Criteria

1. User can enable/disable shadow
2. User can customize shadow offset, blur, color, opacity
3. User can add a secondary shadow
4. User can enable glow effect with color, intensity, size
5. Quick presets (None, Soft, Hard, Neon) work
6. Exported video matches client preview for all effect combinations
7. Existing projects render identically after update

---

## Estimated Scope

- **Type changes**: ~60 lines
- **UI changes**: ~250 lines (StylePanel effects section)
- **Utils**: ~80 lines (effectsToCss, migration)
- **Client render**: ~30 lines
- **Server render**: ~40 lines
- **Presets**: ~60 lines
- **Total**: ~520 lines of changes
