## Skill Loading Order

Load skills using the `Skill` tool before starting work. Pick skills relevant to your current task.

### Planner agent:
1. editorial-planning (content type detection, edit plan format)
2. visual-treatment-guide (treatment selection decision tree)
3. narrative-structure (story arc, emotional pacing)
4. transcript-analysis (sync points, filler detection, beat mapping)
5. screenshot-and-research (web research, reference gathering)

### Editor agent:
1. cutting-and-pacing (cut rules, retention rhythm, Dmytryk's rules)
2. transcript-analysis (filler detection, speech patterns, timestamp analysis)
3. transitions (transition types, timing, narrative meaning)
4. sound-design (music placement, audio layering, volume management)
5. lower-third-and-overlays (overlay composition, safe zones, typography)
6. platform-optimization (platform-specific aspect ratios, pacing, export)

### Animator agent:
1. framer-motion (technique components, spring entrances, stagger patterns)
2. motion-one (spring configs, Disney's 12 principles, timing)
3. video-engagement (hooks, retention, color palettes, visual metaphors)
4. REFERENCE: remotion-best-practices, graphic-designer, interaction-design, lower-third-and-overlays

### Reviewer agent:
1. remotion-best-practices (Remotion patterns, common pitfalls)
2. motion-one (animation timing, easing quality)
3. framer-motion (spring configs, stagger patterns)
4. video-engagement (engagement mechanics, retention checks)

### Orchestrator (Viona):
1. editorial-planning (content type detection, section breakdown)
2. visual-treatment-guide (treatment selection)
3. narrative-structure (story arc, emotional pacing)
4. transcript-analysis (sync points, filler detection)

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
src/
├── PlayerComposition.tsx   # Main composition - imports scenes via registry
├── scenes/                 # Individual scene components (PascalCase)
│   ├── constants.ts        # COLORS, TIMING, SPRING_CONFIG shared across scenes
│   ├── Background.tsx      # Animated background component
│   ├── HookTitle.tsx       # Scene files — one per plan entry
│   ├── DataComparison.tsx
│   └── ...
└── scene-registry.ts       # Auto-generated — maps scene names to components
```

### Import Pattern
```tsx
// In scenes/HookTitle.tsx
import { COLORS, SPRING_CONFIG } from './constants';
import { Background } from './Background';

// In PlayerComposition.tsx — scenes loaded via scene-registry.ts
import { Background } from './components/Background';
```

## Scene Export Convention
- Scene files MUST use `export default` for the component
- Example: `const MyScene: React.FC = () => { ... }; export default MyScene;`
- The scene registry auto-detects default exports. Named exports may not be found.

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
