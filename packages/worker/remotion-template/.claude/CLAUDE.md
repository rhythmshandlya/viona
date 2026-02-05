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

## 3D Animation with Three.js

Pre-installed packages for 3D:
- `@remotion/three` - Use `<ThreeCanvas>` (NOT R3F `<Canvas>`)
- `@react-three/fiber` - React Three Fiber
- `@react-three/drei` - Helpers: useGLTF, Text3D, Box, Sphere, RoundedBox, etc.
- `three` - Core Three.js

### Critical Rules for 3D in Remotion
1. ALWAYS use `useCurrentFrame()` for animation timing
2. NEVER use R3F's `useFrame()` hook - it breaks video rendering
3. Wrap 3D content in `<ThreeCanvas>` from @remotion/three
4. Set rotation/position based on frame number for deterministic output

### Example: Rotating Cube
```tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame } from 'remotion';

export const RotatingCube: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = frame * 0.05;

  return (
    <ThreeCanvas>
      <ambientLight />
      <mesh rotation={[rotation, rotation, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
    </ThreeCanvas>
  );
};
```

### Example: Rolling Dice
```tsx
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame, spring } from 'remotion';
import { RoundedBox } from '@react-three/drei';

export const RollingDice: React.FC = () => {
  const frame = useCurrentFrame();

  const rotationX = spring({ frame, fps: 30, from: 0, to: Math.PI * 4 });
  const rotationZ = spring({ frame, fps: 30, from: 0, to: Math.PI * 2.5 });

  return (
    <ThreeCanvas>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} />
      <RoundedBox args={[1, 1, 1]} radius={0.1} rotation={[rotationX, 0, rotationZ]}>
        <meshStandardMaterial color="white" />
      </RoundedBox>
    </ThreeCanvas>
  );
};
```

## NPM Package Search

If you need a package not pre-installed, use `search_npm_packages("query")`.
Only install packages marked `[+] VALID`.

Example searches:
- "three.js physics" → @react-three/cannon, @react-three/rapier
- "3d text troika" → troika-three-text
- "particles three" → three-nebula
