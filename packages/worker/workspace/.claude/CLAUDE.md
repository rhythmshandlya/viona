# Remotion Visual Generator

## Commands
- `npx tsc --noEmit --pretty false` - TypeScript validation
- `npx remotion bundle --out-dir <path>` - Bundle composition

## Code Style (CRITICAL)
- TypeScript with React functional components
- Use `useCurrentFrame()` and `useVideoConfig()` for all animation timing
- Use `spring()` for entrances/exits — import SPRINGS from constants.ts (SMOOTH: `{ damping: 26, stiffness: 120, mass: 1.0 }`, SNAPPY: `{ damping: 18, stiffness: 180, mass: 0.8 }`)
- Use `interpolate()` with BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` ALWAYS
- Stagger elements by 6+ frames minimum (NEVER animate all at once)

## File Structure
```
src/proj_<id>/
├── index.tsx           # Main composition - imports and assembles scenes
├── constants.ts        # COLORS, TIMING, SPRING_CONFIG
├── metadata.json       # Composition metadata for renderer
├── components/         # Reusable components
│   ├── Background.tsx  # Animated background
│   └── ...             # Shared icons, shapes, etc.
└── scenes/             # Individual scene components
    ├── Scene1.tsx
    ├── Scene2.tsx
    └── ...
```

### Import Pattern
```tsx
// In scenes/Scene1.tsx
import { COLORS, SPRING_CONFIG } from '../constants';
import { Background } from '../components/Background';

// In index.tsx
import { Scene1 } from './scenes/Scene1';
import { Background } from './components/Background';
```

## Common Gotchas
- NEVER use `Math.sin/cos` on text positions (causes jittery text)
- NEVER use damping < 20 (too bouncy)
- NEVER use R3F's `useFrame()` hook - breaks video rendering
- For 3D: use `<ThreeCanvas>` from @remotion/three, NOT R3F `<Canvas>`

## Available Skills

### Core Animation & Video
- `remotion-best-practices` - Official Remotion patterns, 3D, audio, animations
- `motion-one` - Animation principles and timing
- `framer-motion` - Framer Motion patterns (adaptable to Remotion)
- `interaction-design` - Interaction and motion design patterns

### Visual Design & Graphics
- `frontend-design` - Avoid generic AI aesthetics, bold design decisions
- `graphic-designer` - Graphic design principles
- `marketing-visual-design` - Marketing-focused visual design
- `tailwind-v4-shadcn` - Modern styling patterns

### Code Quality
- `vercel-react-best-practices` - React performance optimization from Vercel
- `typescript-skills` - TypeScript patterns

## Skill Usage

When implementing visual effects from a plan:
1. Check `remotion-best-practices` for Remotion-specific patterns
2. Check `motion-one` for animation timing and easing
3. Check `frontend-design` to avoid generic/boring aesthetics
4. Check `graphic-designer` for visual composition principles

For techniques like particle-emitter, mask-reveal, cell-division - implement with physics-based animations, not simple fades.
