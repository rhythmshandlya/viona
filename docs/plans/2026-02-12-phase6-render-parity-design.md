# Phase 6: Render Parity Verification

## Overview

This phase ensures complete visual fidelity between client preview and server export. While each phase (1-4) includes render parity work, this final phase provides comprehensive verification, testing procedures, and documentation for maintaining parity going forward.

## Render Parity Checklist

### Phase 1: Typography

| Property | Client Location | Server Location | Status |
|----------|-----------------|-----------------|--------|
| `opacity` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `lineHeight` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `stroke.width` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `stroke.color` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `letterSpacing` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `textTransform` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |

**CSS Property Mapping:**
```typescript
// Both client and server must produce identical CSS:
{
  opacity: style.opacity ?? 1,
  lineHeight: style.lineHeight ?? 1.4,
  WebkitTextStroke: style.stroke
    ? `${style.stroke.width}px ${style.stroke.color}`
    : undefined,
  letterSpacing: style.letterSpacing
    ? `${style.letterSpacing}px`
    : undefined,
  textTransform: style.textTransform ?? 'none',
}
```

---

### Phase 2: Positioning

| Property | Client Location | Server Location | Status |
|----------|-----------------|-----------------|--------|
| `position.anchor` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `position.offsetX` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `position.offsetY` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `position.rotation` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `position.textAlign` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |

**Shared Position Calculation:**
```typescript
// This function MUST be identical in both locations
// Recommend: Move to packages/shared/src/position-utils.ts

function calculatePositionStyles(position: CaptionPosition): React.CSSProperties {
  const { anchor, offsetX, offsetY, rotation, textAlign } = position;

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

  const left = `${50 + offsetX}%`;

  const transform = anchor === 'center'
    ? `translate(-50%, -50%) rotate(${rotation}deg)`
    : `translateX(-50%) rotate(${rotation}deg)`;

  return {
    position: 'absolute',
    left,
    top,
    bottom,
    transform,
    textAlign,
    width: '90%',
  };
}
```

---

### Phase 3: Effects

| Property | Client Location | Server Location | Status |
|----------|-----------------|-----------------|--------|
| `effects.shadow` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `effects.shadowSecondary` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `effects.glow` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |

**Shared Effects Conversion:**
```typescript
// This function MUST be identical in both locations
// Recommend: Move to packages/shared/src/effects-utils.ts

function effectsToCss(effects: CaptionEffects): React.CSSProperties {
  const shadows: string[] = [];

  if (effects.shadow) {
    const { offsetX, offsetY, blur, color, opacity } = effects.shadow;
    shadows.push(`${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`);
  }

  if (effects.shadowSecondary) {
    const { offsetX, offsetY, blur, color, opacity } = effects.shadowSecondary;
    shadows.push(`${offsetX}px ${offsetY}px ${blur}px rgba(${hexToRgb(color)}, ${opacity})`);
  }

  if (effects.glow?.enabled) {
    const { color, intensity, size } = effects.glow;
    const rgb = hexToRgb(color);
    shadows.push(`0 0 ${size * 0.3}px rgba(${rgb}, ${intensity})`);
    shadows.push(`0 0 ${size * 0.6}px rgba(${rgb}, ${intensity * 0.7})`);
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

---

### Phase 4: Animation

| Property | Client Location | Server Location | Status |
|----------|-----------------|-----------------|--------|
| `animation.in` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.out` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.active` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.easing` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.timing.inDuration` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.timing.outDuration` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.timing.inDelay` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.timing.stagger` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |
| `animation.intensity.scale` | `Composition.tsx` | `AnimatedSubtitle.tsx` | ☐ Verify |

**Animation System:**
- Both use `packages/renderer/src/animations/resolve.ts`
- Animation functions in `packages/renderer/src/animations/animations.ts`
- Easing functions in `packages/renderer/src/animations/easing.ts`

---

## Shared Code Strategy

### Recommended Structure

Move shared logic to `packages/shared` or `packages/renderer`:

```
packages/
├── shared/
│   └── src/
│       ├── types/
│       │   └── index.ts          # All type definitions
│       ├── position-utils.ts     # calculatePositionStyles
│       ├── effects-utils.ts      # effectsToCss, hexToRgb
│       └── style-migration.ts    # All migration functions
│
├── renderer/
│   └── src/
│       ├── animations/
│       │   ├── animations.ts     # Animation functions
│       │   ├── easing.ts         # Easing functions
│       │   ├── resolve.ts        # Animation resolver
│       │   └── types.ts          # Animation types
│       └── components/
│           └── AnimatedSubtitle.tsx
```

### Import Strategy

Both client and server import from shared packages:

```typescript
// In apps/web/src/features/editor-v2/player/Composition.tsx
import { calculatePositionStyles } from '@reelify/shared/position-utils';
import { effectsToCss } from '@reelify/shared/effects-utils';
import { resolveAnimation } from '@reelify/renderer/animations';

// In packages/renderer/src/components/AnimatedSubtitle.tsx
import { calculatePositionStyles } from '@reelify/shared/position-utils';
import { effectsToCss } from '@reelify/shared/effects-utils';
import { resolveAnimation } from '../animations';
```

---

## Visual Comparison Testing

### Automated Screenshot Comparison

Create test script to compare client vs server renders:

```typescript
// scripts/test-render-parity.ts

interface ParityTestCase {
  name: string;
  style: Partial<CaptionStyle>;
  words: CaptionWord[];
  atTimeMs: number;
}

const testCases: ParityTestCase[] = [
  // Phase 1: Typography
  {
    name: 'opacity-50',
    style: { opacity: 0.5 },
    words: [{ text: 'Hello', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },
  {
    name: 'line-height-2',
    style: { lineHeight: 2.0 },
    words: [
      { text: 'Line', startMs: 0, endMs: 500 },
      { text: 'One', startMs: 500, endMs: 1000 },
    ],
    atTimeMs: 500,
  },
  {
    name: 'stroke-red',
    style: { stroke: { width: 3, color: '#ff0000' } },
    words: [{ text: 'Stroke', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },

  // Phase 2: Positioning
  {
    name: 'position-offset-x',
    style: { position: { anchor: 'bottom', offsetX: -25, offsetY: 0, rotation: 0, textAlign: 'center' } },
    words: [{ text: 'Left', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },
  {
    name: 'position-rotation',
    style: { position: { anchor: 'center', offsetX: 0, offsetY: 0, rotation: 15, textAlign: 'center' } },
    words: [{ text: 'Rotated', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },

  // Phase 3: Effects
  {
    name: 'shadow-custom',
    style: {
      effects: {
        shadow: { offsetX: 5, offsetY: 5, blur: 10, color: '#ff0000', opacity: 0.8 },
        shadowSecondary: null,
        glow: null,
      },
    },
    words: [{ text: 'Shadow', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },
  {
    name: 'glow-cyan',
    style: {
      effects: {
        shadow: null,
        shadowSecondary: null,
        glow: { enabled: true, color: '#00ffff', intensity: 0.8, size: 30 },
      },
    },
    words: [{ text: 'Glow', startMs: 0, endMs: 1000 }],
    atTimeMs: 500,
  },

  // Phase 4: Animation
  {
    name: 'animation-stagger',
    style: {
      animation: {
        in: 'elastic-pop',
        active: 'none',
        out: 'none',
        easing: 'spring',
        timing: { inDuration: 200, outDuration: 100, inDelay: 0, stagger: 50 },
        intensity: { scale: 1.0 },
      },
    },
    words: [
      { text: 'One', startMs: 0, endMs: 500 },
      { text: 'Two', startMs: 0, endMs: 500 },
      { text: 'Three', startMs: 0, endMs: 500 },
    ],
    atTimeMs: 150,
  },
];

async function runParityTests() {
  for (const testCase of testCases) {
    // 1. Render client preview screenshot
    const clientScreenshot = await captureClientPreview(testCase);

    // 2. Render server frame
    const serverFrame = await renderServerFrame(testCase);

    // 3. Compare images
    const diff = await compareImages(clientScreenshot, serverFrame);

    // 4. Report
    if (diff.percentDifferent > 0.1) {
      console.error(`❌ FAIL: ${testCase.name} - ${diff.percentDifferent}% different`);
      await saveDiffImage(testCase.name, diff);
    } else {
      console.log(`✓ PASS: ${testCase.name}`);
    }
  }
}
```

### Manual Testing Procedure

For each new style property:

1. **Create test project** with caption using the property
2. **Take client screenshot** at specific frame
3. **Export video** from server
4. **Extract frame** from exported video at same timestamp
5. **Compare visually** - should be pixel-identical (or nearly)

```bash
# Extract frame from exported video
ffmpeg -i output.mp4 -ss 00:00:00.500 -frames:v 1 server-frame.png

# Compare with client screenshot
# Use image diff tool or visual inspection
```

---

## Common Parity Issues

### Issue 1: Font Rendering Differences

**Problem:** Fonts may render slightly differently between browser and Remotion.

**Solution:**
- Use web-safe fonts or ensure exact same font files
- Set explicit font-weight values
- Avoid sub-pixel font sizes

```typescript
// Use integer font sizes
fontSize: Math.round(style.fontSize),

// Explicit font-weight
fontWeight: style.fontWeight, // Not 'bold', use 700
```

### Issue 2: Transform Origin

**Problem:** Rotation/scale may pivot from different points.

**Solution:**
```typescript
// Always specify transform-origin explicitly
transformOrigin: 'center center',
```

### Issue 3: CSS Property Support

**Problem:** Some CSS properties behave differently in Remotion's headless Chrome.

**Solution:**
- Test each new CSS property in Remotion specifically
- Use `-webkit-` prefixes where needed
- Avoid bleeding-edge CSS features

```typescript
// Use webkit prefix for text-stroke
WebkitTextStroke: `${width}px ${color}`,
// NOT: textStroke (not supported)
```

### Issue 4: Animation Timing

**Problem:** Frame-based vs time-based calculations may drift.

**Solution:**
```typescript
// Always calculate from frame, not Date.now()
const currentTimeMs = (frame / fps) * 1000;

// Use consistent fps between client and server
const fps = 30; // Must match
```

### Issue 5: Color Format Differences

**Problem:** rgba() vs hex colors may render differently.

**Solution:**
```typescript
// Normalize all colors to same format
function normalizeColor(color: string): string {
  // Convert hex to rgba for consistency
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    return `rgba(${rgb}, 1)`;
  }
  return color;
}
```

---

## Render Pipeline Verification

### Data Flow Check

Ensure caption styles flow correctly from editor to render:

```
Editor (client)
    ↓
saveProject() → API
    ↓
Database (PostgreSQL)
    ↓
render job → Worker
    ↓
Remotion render props
    ↓
AnimatedSubtitle.tsx
    ↓
Exported video
```

### API Payload Verification

Log and verify the render payload includes all style properties:

```typescript
// In packages/worker/src/processors/render.ts

console.log('Caption style for render:', JSON.stringify(captionItem.data.style, null, 2));

// Should include all properties:
// {
//   opacity: 0.8,
//   lineHeight: 1.4,
//   stroke: { width: 2, color: '#000000' },
//   position: { anchor: 'bottom', offsetX: 0, ... },
//   effects: { shadow: {...}, glow: {...} },
//   animation: { in: 'elastic-pop', timing: {...}, ... },
//   ...
// }
```

---

## Testing Matrix

### Full Test Matrix

| Property | Value | Client | Server | Match |
|----------|-------|--------|--------|-------|
| opacity | 0.5 | ☐ | ☐ | ☐ |
| opacity | 1.0 | ☐ | ☐ | ☐ |
| lineHeight | 1.0 | ☐ | ☐ | ☐ |
| lineHeight | 2.0 | ☐ | ☐ | ☐ |
| stroke | 2px black | ☐ | ☐ | ☐ |
| stroke | 5px red | ☐ | ☐ | ☐ |
| position.offsetX | -25% | ☐ | ☐ | ☐ |
| position.offsetX | +25% | ☐ | ☐ | ☐ |
| position.offsetY | -10% | ☐ | ☐ | ☐ |
| position.rotation | 15° | ☐ | ☐ | ☐ |
| position.rotation | -30° | ☐ | ☐ | ☐ |
| shadow.blur | 0px | ☐ | ☐ | ☐ |
| shadow.blur | 20px | ☐ | ☐ | ☐ |
| shadow.color | red | ☐ | ☐ | ☐ |
| shadowSecondary | enabled | ☐ | ☐ | ☐ |
| glow | cyan 80% | ☐ | ☐ | ☐ |
| glow | magenta 50% | ☐ | ☐ | ☐ |
| animation.timing.inDuration | 300ms | ☐ | ☐ | ☐ |
| animation.timing.stagger | 50ms | ☐ | ☐ | ☐ |
| animation.intensity | 0.5x | ☐ | ☐ | ☐ |
| animation.intensity | 2.0x | ☐ | ☐ | ☐ |
| blur-in animation | - | ☐ | ☐ | ☐ |
| spin animation | - | ☐ | ☐ | ☐ |
| glitch animation | - | ☐ | ☐ | ☐ |

---

## Files to Verify/Modify

| File | Purpose |
|------|---------|
| `packages/shared/src/types/index.ts` | Ensure all types exported |
| `packages/shared/src/position-utils.ts` | Create shared position calculator |
| `packages/shared/src/effects-utils.ts` | Create shared effects converter |
| `packages/renderer/src/components/AnimatedSubtitle.tsx` | Import shared utils |
| `apps/web/src/features/editor-v2/player/Composition.tsx` | Import shared utils |
| `packages/worker/src/processors/render.ts` | Verify all props passed |
| `scripts/test-render-parity.ts` | Create automated tests |

---

## Success Criteria

1. All properties from phases 1-4 render identically on client and server
2. Automated parity tests pass for all test cases
3. No visual differences > 0.1% between client and server
4. Shared utility functions used by both client and server
5. Documentation of known limitations (if any)
6. CI integration for parity tests (optional but recommended)

---

## Maintenance Guidelines

### Adding New Style Properties

When adding new style properties in the future:

1. **Add type** to `packages/shared/src/types/index.ts`
2. **Add default** to `DEFAULT_CAPTION_STYLE`
3. **Add migration** for backward compatibility
4. **Add client rendering** in `Composition.tsx`
5. **Add server rendering** in `AnimatedSubtitle.tsx`
6. **Add parity test case** to test matrix
7. **Run parity tests** before merging

### Code Review Checklist

For any PR touching caption styles:

- [ ] Type added to shared types?
- [ ] Default value defined?
- [ ] Migration for old data?
- [ ] Client rendering updated?
- [ ] Server rendering updated?
- [ ] Using shared utility (not duplicated code)?
- [ ] Parity test added?
- [ ] Parity test passing?
