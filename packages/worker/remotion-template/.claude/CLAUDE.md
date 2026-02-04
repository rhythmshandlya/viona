# Remotion Visual Generator Workspace

## Code Style
- Use TypeScript with React
- All components must be typed
- Use `useCurrentFrame()` and `useVideoConfig()` hooks
- Prefer `interpolate()` over manual calculations
- Use `spring()` for all entrance/exit animations

## Animation Rules (CRITICAL)
- ALWAYS use spring config: `{ damping: 22, stiffness: 90, mass: 0.9 }`
- Stagger elements by 6+ frames minimum (never animate all at once)
- Use `extrapolateRight: 'clamp'` in all interpolate() calls
- NEVER use Math.sin/cos on text positions (causes jittery text)
- Minimum animation duration: 15 frames

## File Structure
When generating a project (e.g., proj_abc123):
```
src/
├── proj_abc123/
│   ├── constants.ts   # Colors, timing, sizes, spring configs
│   └── index.tsx      # Main composition with ALL scenes
```

## Required Exports in constants.ts
```typescript
export const COLORS = { ... };
export const TIMING = { ... };
export const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
```

## Required Structure in index.tsx
```typescript
import { Composition, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from 'remotion';
import { COLORS, TIMING, SPRING_CONFIG } from './constants';

// Scene components
const Scene1: React.FC = () => { ... };
const Scene2: React.FC = () => { ... };

// Main composition
export const MainComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence from={0} durationInFrames={TIMING.scene1}>
        <Scene1 />
      </Sequence>
      <Sequence from={TIMING.scene1} durationInFrames={TIMING.scene2}>
        <Scene2 />
      </Sequence>
    </AbsoluteFill>
  );
};
```

## Validation Commands
- TypeScript check: `npx tsc --noEmit --pretty false`
- Bundle: `npx remotion bundle`

## Common Mistakes to Avoid
1. Forgetting to import spring config from constants
2. Using damping < 20 (too bouncy)
3. Animating all elements at frame 0 (no stagger)
4. Missing `extrapolateRight: 'clamp'` (animation overshoots)
5. Using Math.sin for text motion (jittery)
