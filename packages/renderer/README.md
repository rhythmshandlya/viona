# @viona/renderer

Remotion-based video rendering and subtitle animation engine for Viona.

## Overview

This package provides:

- A `VideoComposition` Remotion component that layers subtitles over video
- An `AnimatedSubtitle` component with word-level timing, per-word style overrides, and multiple display modes (word-by-word, phrase, karaoke)
- A pluggable animation engine with 29 animation types across four categories, six easing functions, and three-phase lifecycle (in/active/out)
- A `renderVideo()` function that bundles the composition and renders to H.264 via `@remotion/renderer`

## Architecture

```
src/
├── index.ts                # Public API — re-exports render function, components, animation engine
├── remotion-entry.tsx      # Remotion registerRoot entry point (registers VionaVideo composition, loads Google Fonts)
├── render.ts               # renderVideo() — bundles via @remotion/bundler, renders via @remotion/renderer
├── components/
│   ├── VideoComposition.tsx # Top-level composition: OffthreadVideo + Sequence-per-subtitle
│   └── AnimatedSubtitle.tsx # Word-level animated captions with position, effects, typography, display modes
└── animations/
    ├── index.ts             # Barrel re-exports for the animation sub-package
    ├── types.ts             # AnimationType, EasingType, AnimationConfig, AnimationFn, AnimationPhase, ResolvedAnimation
    ├── animations.ts        # ANIMATION_REGISTRY — 29 animation types with in/active/out functions
    ├── easing.ts            # Easing functions: linear, easeOut, easeInOut, spring, elastic, bounce
    ├── resolve.ts           # resolveAnimation() — maps word timing context to CSS styles per phase
    └── migrate.ts           # migrateAnimation() — converts legacy string names (pop, fade, highlight) to AnimationConfig
```

## Exports

### Main (`@viona/renderer`)

```typescript
import {
  renderVideo,           // Bundles and renders a video to disk
  VideoComposition,      // Remotion composition component
  AnimatedSubtitle,      // Word-level animated subtitle component
} from '@viona/renderer';

// Types
import type {
  RenderOptions,
  VideoCompositionProps,
  SubtitleItem,
  SubtitleWord,
  SubtitleStyle,
} from '@viona/renderer';
```

### Animations (`@viona/renderer/animations`)

```typescript
import {
  getAnimation,          // Look up an AnimationFn by type and phase
  ANIMATION_REGISTRY,    // Full registry of all 29 animation types
  getEasing,             // Look up an easing function by name
  linear, easeOut, spring, elastic, bounce,  // Named easing functions
  resolveAnimation,      // Resolve animation config + word timing into CSS styles
  isAnimationConfig,     // Type guard for AnimationConfig objects
  migrateAnimation,      // Convert legacy string animation names to AnimationConfig
} from '@viona/renderer/animations';

// Types
import type {
  AnimationType,
  EasingType,
  AnimationConfig,
  AnimationFn,
  AnimationPhase,
  ResolvedAnimation,
  WordTimingContext,
} from '@viona/renderer/animations';
```

## Components

### VideoComposition

Top-level Remotion composition that renders a full-screen video with subtitle overlays. Each `SubtitleItem` is placed in its own `<Sequence>` based on its timing.

**Props:** `VideoCompositionProps`
- `videoUrl` — URL or filename for the background video (served via `OffthreadVideo`)
- `subtitles` — Array of `SubtitleItem` objects, each with `id`, `startMs`, `endMs`, `text`, `words`, and optional `style`
- `defaultSubtitleStyle` — Optional `SubtitleStyle` applied to all subtitles (per-subtitle styles override)

### AnimatedSubtitle

Renders a group of words with per-word timing, animation, positioning, effects, and typography. Supports three display modes:

| Mode | Behavior |
|------|----------|
| `phrase` (default) | All words visible, active word highlighted |
| `word-by-word` | Only the currently active word is shown |
| `karaoke` | All words visible, progressive color fill sweeps across each word |

**Style system (`SubtitleStyle`):**
- Typography: `fontFamily`, `fontSize`, `fontWeight`, `opacity`, `lineHeight`, `letterSpacing`, `textTransform`, `stroke`
- Color: `color`, `activeColor`, `backgroundColor`, `activeBackgroundColor`
- Position: V2 `SubtitlePosition` object (`anchor`, `offsetX`, `offsetY`, `rotation`, `textAlign`) with legacy string migration
- Animation: `AnimationConfig` object or legacy string (auto-migrated)
- Effects: `CaptionEffects` (`shadow`, `shadowSecondary`, `glow`) with legacy `textShadow` migration
- Per-word overrides via `SubtitleWord.styleOverrides`

## Animation Engine

### Animation Types (29 total)

**Viral:** `elastic-pop`, `bounce-up`, `shake`, `color-wipe`, `3d-flip`, `punch`, `scale-bounce`, `slide-up`, `weight-shift`, `float`

**Cinematic:** `fade`, `fade-rise`, `typewriter`, `smooth-slide`, `soft-scale`, `underline-wipe`

**Ad / Premium:** `apple-fade`, `google-slide`, `clean-scale`, `letter-cascade`, `smooth-reveal`

**Motion:** `spotlight-reveal`, `film-burn`, `glitch`, `spin-reveal`, `drop-slam`, `wave`, `blur-zoom`, `chromatic-split`

Each animation defines up to three phase functions (`in`, `active`, `out`) that map a 0-1 progress value to CSS properties.

### Easing Functions (6 total)

`linear`, `ease-out`, `ease-in-out`, `spring`, `elastic`, `bounce`

### Resolution Pipeline

1. `isAnimationConfig()` checks whether the value is already an `AnimationConfig`; if not, `migrateAnimation()` converts legacy strings (`pop`, `fade`, `highlight`) into a config object.
2. `resolveAnimation(config, wordTimingContext)` determines the current phase (in/active/out/idle) based on word elapsed time, applies the easing function, and calls the matching `AnimationFn` from the registry.
3. The resulting `CSSProperties` are spread onto each word's `<span>`.

## Rendering Pipeline (`renderVideo`)

1. Bundles `remotion-entry.tsx` using `@remotion/bundler` (cached after first call)
2. Copies local video files into the bundle directory so Remotion's dev server can serve them
3. Selects the `VionaVideo` composition and overrides dimensions, FPS, and duration
4. Renders to H.264 via `@remotion/renderer` with memory-efficient settings (concurrency 1, 50 MB video cache, 4 FFmpeg threads)
5. Reports progress via optional `onProgress` callback

### Remotion Entry (`remotion-entry.tsx`)

Registers the `VionaVideo` composition and preloads 20 Google Fonts (Inter, Anton, Montserrat, Poppins, Nunito, Playfair Display, JetBrains Mono, Roboto, Merriweather, Bebas Neue, Space Grotesk, DM Sans, Outfit, Rubik, Lora, Source Sans 3, Fira Code, Oswald, Lato, Open Sans) via `@remotion/google-fonts` for headless browser rendering.

## Dependencies

- **remotion** `4.0.422` — Video composition framework
- **@remotion/bundler** `4.0.422` — Webpack bundling for Remotion compositions
- **@remotion/renderer** `4.0.422` — Headless video rendering
- **@remotion/google-fonts** `4.0.422` — Google Fonts loading for server-side rendering
- **react** / **react-dom** `^18.2.0` — UI components
- **@viona/shared** `workspace:*` — Shared types

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck
```
