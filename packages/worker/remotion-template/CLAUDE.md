# Remotion Visual Generator

## Commands
- `npx tsc --noEmit --pretty false` - TypeScript validation
- `npx remotion bundle --out-dir <path>` - Bundle composition

## Code Style (CRITICAL)
- TypeScript with React functional components
- Use `useCurrentFrame()` and `useVideoConfig()` for all animation timing
- Use `spring()` for entrances/exits — import SPRINGS from constants.ts (SMOOTH: `{ damping: 26, stiffness: 120, mass: 1.0 }`, SNAPPY: `{ damping: 22, stiffness: 170, mass: 0.8 }`)
- Use `interpolate()` with BOTH `extrapolateLeft: 'clamp'` AND `extrapolateRight: 'clamp'` ALWAYS
- inputRange array MUST be strictly monotonically increasing (each value > previous) — e.g. `[0, 15, 30]` not `[0, 1, 0.4]`
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
- NEVER use damping < 18 (too bouncy). SNAPPY (22) is the floor for hero reveals.
- NEVER use R3F's `useFrame()` hook - breaks video rendering
- For 3D: use `<ThreeCanvas>` from @remotion/three, NOT R3F `<Canvas>`
- Vary visual techniques across scenes — don't put every scene in a card. Use path drawing, animated diagrams, morphing, particles as alternatives.
- Non-card templates available: `path-draw-reveal`, `animated-diagram`, `shape-morph-transition`

## MANDATORY: Use Skills Before Writing Code

**Before writing ANY scene code, you MUST read the relevant skills using the Skill tool.** Skills contain critical patterns, reusable components, and design principles that prevent common mistakes.

### Required Skills (read these FIRST)
1. **`framer-motion`** - Animation patterns, reusable technique components (Card, ParticleEmitter, AnimatedCounter, FlowingStream), prohibited patterns
2. **`motion-one`** - Spring configs, Disney's 12 principles, stagger timing, choreography phases
3. **`video-engagement`** - Hook techniques, retention, color palettes, scene structure, visual metaphors

### Reference Skills (read when relevant)
4. **`remotion-best-practices`** - Official Remotion patterns (shapes, noise, paths, transitions, 3D, audio). Read specific rule files for advanced effects.
5. **`frontend-design`** - Avoid generic AI aesthetics, bold design decisions
6. **`interaction-design`** - Interaction timing and motion design patterns
7. **`typescript-skills`** - TypeScript patterns

### Skill Usage Flow
```
1. Read `framer-motion` for technique components and patterns
2. Read `motion-one` for spring configs and timing
3. Read `video-engagement` for engagement strategy and visual metaphors
4. Check `remotion-best-practices` rules/ for specific Remotion APIs (@remotion/shapes, @remotion/noise, etc.)
5. Write code using patterns from skills — do NOT reinvent what skills already provide
```

For techniques like particle-emitter, cards, counters, flowing-streams — use the implementations from `framer-motion` skill directly. Do NOT simplify or rewrite them.
