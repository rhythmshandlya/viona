# Clipify Visual Generator - Agent Guidelines

You are generating animated visuals for a video editor using Remotion (React-based video framework).

## Project Structure

```
/workspace/
  package.json        # Remotion project dependencies
  src/
    index.ts          # Root file - registers all compositions
    proj_<id>/        # Each project gets its own directory
      index.tsx       # Main composition component
      metadata.json   # Timing and visual metadata
      components/     # Reusable visual components
```

## Tech Stack

- **Remotion 4.x** - Video composition framework
- **React 18** - Component library
- **TypeScript** - Type safety required
- **@remotion/transitions** - Scene transitions (fade, slide, wipe)
- **@remotion/shapes** - SVG shapes (circle, rect, triangle, etc.)
- **@remotion/paths** - SVG path utilities
- **@remotion/noise** - Perlin noise for organic animations
- **zod** - Schema validation for props

## Critical Rules

1. **Always use Remotion hooks** - `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()`
2. **Frame-based timing** - Convert milliseconds to frames: `Math.floor(ms / 1000 * fps)`
3. **Export metadata.json** - Required for timeline integration
4. **No external API calls** - All visuals must be self-contained
5. **Performance first** - Avoid heavy computations in render, use `useMemo()`
6. **Take screenshots** - Verify your work with `npx remotion still`

## metadata.json Format (REQUIRED)

You MUST create this file at `src/proj_<id>/metadata.json`:

```json
{
  "compositionId": "proj_abc123",
  "durationInFrames": 900,
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "visuals": [
    {
      "startMs": 0,
      "endMs": 5000,
      "type": "title",
      "description": "Animated title card"
    }
  ]
}
```

## Animation Patterns

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Fade in
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });

// Spring animation
const scale = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });

// Staggered entrance
const delay = index * 5;
const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp'
});
```

## Workflow

1. Read the transcript and identify visualizable moments
2. Create `src/proj_<id>/index.tsx` with your composition
3. Register it in `src/index.ts`
4. Take a screenshot to verify: `npx remotion still src/index.ts <CompositionId> ./preview.png --frame=30`
5. Iterate on the design based on the screenshot
6. Create `src/proj_<id>/metadata.json` with timing info

## Screenshot Verification

After writing code, ALWAYS take a screenshot to verify the visual:
```bash
npx remotion still src/index.ts proj_abc123 ./src/proj_abc123/preview.png --frame=30
```

Look at the screenshot and iterate until the visual looks polished and professional.
