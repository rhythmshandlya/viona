# Remotion Visual Generator

## Commands
- `npx tsc --noEmit --pretty false` - TypeScript validation
- `npx remotion bundle --out-dir <path>` - Bundle composition

## Code Style (CRITICAL)
- TypeScript with React functional components
- Use `useCurrentFrame()` and `useVideoConfig()` for all animation timing
- Use `spring()` for entrances/exits — import SPRINGS from constants.ts (SMOOTH: `{ damping: 26, stiffness: 120, mass: 1.0 }`, SNAPPY: `{ damping: 18, stiffness: 180, mass: 0.8 }`)
- Use `interpolate()` with `extrapolateRight: 'clamp'` ALWAYS
- Stagger elements by 6+ frames minimum (NEVER animate all at once)
- Text entrances: fade + gentle scale (1.05-1.15x max) via SPRINGS.SMOOTH — never slam, crash, or zoom text onto screen

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
- NEVER use `Math.sin/cos` on text or any parent container holding text (OK only for Layer 3 particles at opacity <= 0.15)
- NEVER use damping < 20 (too bouncy)
- NEVER use R3F's `useFrame()` hook - breaks video rendering
- For 3D: use `<ThreeCanvas>` from @remotion/three, NOT R3F `<Canvas>`
- NEVER scatter elements at independent absolute positions — wrap all content in a single centered flex column
- NEVER overlay domain-specific decorative SVGs on the dot-grid (pool lanes, circuits, etc.)
- NEVER hardcode 1080/1920 in scene files — use EW/EH from constants.ts

## Animation Quality Rules
- Always pair opacity + transform for entries (never opacity alone)
- Entries: ease-out (fast appear, smooth settle). Exits: ease-in (75% of entry duration)
- Stagger with variable delays (4, 6, 8 frames) not uniform gaps
- Text scale max 1.15x during entry — never slam/zoom
- Add micro-motion to persistent elements (0.5% scale oscillation over 90 frames)
- Spring damping >= 20 always, no exceptions

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
