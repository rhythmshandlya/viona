# Physics Baking for Realistic Animations

## Problem Statement

AI-generated animations currently use simple easing (e.g., `ease-in-out`) for all motion. When physics is required—objects falling, bouncing, or colliding—the animations look unnatural because they lack:

- Gravity and acceleration
- Parabolic trajectories for projectiles
- Bounce with energy loss (coefficient of restitution)
- Collision detection and response
- Natural momentum and friction

**Example failure:** A falling object drops in a straight line with uniform speed instead of accelerating due to gravity and bouncing on impact.

## Solution: Matter.js with Physics Baking

Integrate Matter.js (2D rigid body physics engine) using a "baking" pattern recommended by the Remotion community. Since Remotion renders frames independently, physics must be pre-computed before rendering.

### References

- [Remotion Third-Party Docs - Matter.js](https://remotion.dev/docs/third-party)
- [Physics Engine Baking Discussion](https://github.com/orgs/remotion-dev/discussions/4373)
- [Matter.js Documentation](https://brm.io/matter-js/)

## Architecture

```
┌─────────────────────────────────────────┐
│  1. Baking Layer                        │
│     bakePhysics(setup, fps, duration)   │
│     - Runs Matter.js simulation         │
│     - Stores body states per frame      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  2. Playback Layer                      │
│     usePhysicsBody(bakedData, bodyId)   │
│     - Uses useCurrentFrame()            │
│     - Returns { x, y, angle } for body  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  3. Rendering Layer                     │
│     <PhysicsBody> component             │
│     - Applies transform to children     │
│     - Handles coordinate mapping        │
└─────────────────────────────────────────┘
```

### How Baking Works

1. **Pre-simulation**: Run Matter.js engine through all frames before rendering
2. **Data capture**: Store each body's position, angle, and velocity at every frame
3. **Timeline playback**: Retrieve stored states frame-by-frame using `useCurrentFrame()`

This approach:
- Maintains deterministic rendering (same output every time)
- Allows timeline scrubbing (forward and backward)
- Keeps Remotion's frame-based architecture intact

## Package Structure

```
packages/
├── physics/                    # NEW PACKAGE
│   ├── src/
│   │   ├── index.ts           # Public exports
│   │   ├── bake.ts            # bakePhysics function
│   │   ├── hooks.ts           # usePhysicsBody hook
│   │   ├── components.tsx     # PhysicsBody component
│   │   ├── presets.ts         # Material and scenario presets
│   │   └── types.ts           # TypeScript interfaces
│   ├── AGENT_GUIDE.md         # Documentation for AI agent
│   ├── package.json
│   └── tsconfig.json
├── renderer/                   # Existing - imports @clipify/physics
├── worker/                     # Existing - agent has access to physics
└── shared/                     # Existing
```

### Dependencies

```json
{
  "name": "@clipify/physics",
  "version": "0.1.0",
  "dependencies": {
    "matter-js": "^0.19.0"
  },
  "devDependencies": {
    "@types/matter-js": "^0.19.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "remotion": "^4.0.0"
  }
}
```

## API Design

### Types

```typescript
// packages/physics/src/types.ts

export interface Vector2D {
  x: number;
  y: number;
}

export interface BodyState {
  id: string;
  position: Vector2D;
  angle: number;
  velocity: Vector2D;
  angularVelocity: number;
}

export interface FrameState {
  frame: number;
  bodies: Record<string, BodyState>;
}

export interface BakedPhysics {
  fps: number;
  duration: number;
  totalFrames: number;
  frames: FrameState[];
}

export interface WorldConfig {
  gravity?: Vector2D;
  bounds?: { width: number; height: number };
}

export interface BakeOptions {
  fps: number;
  duration: number;
  worldConfig?: WorldConfig;
  setup: (world: Matter.World, engine: Matter.Engine) => void;
}
```

### Baking Function

```typescript
// packages/physics/src/bake.ts

import Matter from 'matter-js';
import { BakeOptions, BakedPhysics, BodyState, FrameState } from './types';

export function bakePhysics(options: BakeOptions): BakedPhysics {
  const { fps, duration, worldConfig = {}, setup } = options;
  const totalFrames = Math.ceil(fps * duration);
  const timeStep = 1000 / fps;

  // Create engine and world
  const engine = Matter.Engine.create();
  const world = engine.world;

  // Configure gravity
  if (worldConfig.gravity) {
    engine.gravity.x = worldConfig.gravity.x;
    engine.gravity.y = worldConfig.gravity.y;
  }

  // Run user setup
  setup(world, engine);

  // Bake simulation
  const frames: FrameState[] = [];

  for (let frame = 0; frame < totalFrames; frame++) {
    // Capture state before stepping
    const bodies: Record<string, BodyState> = {};

    for (const body of Matter.Composite.allBodies(world)) {
      if (body.label && !body.isStatic) {
        bodies[body.label] = {
          id: body.label,
          position: { x: body.position.x, y: body.position.y },
          angle: body.angle,
          velocity: { x: body.velocity.x, y: body.velocity.y },
          angularVelocity: body.angularVelocity,
        };
      }
    }

    frames.push({ frame, bodies });

    // Step simulation
    Matter.Engine.update(engine, timeStep);
  }

  return {
    fps,
    duration,
    totalFrames,
    frames,
  };
}
```

### Playback Hook

```typescript
// packages/physics/src/hooks.ts

import { useCurrentFrame } from 'remotion';
import { BakedPhysics, BodyState } from './types';

export function usePhysicsBody(
  bakedData: BakedPhysics,
  bodyId: string
): BodyState | null {
  const frame = useCurrentFrame();
  const clampedFrame = Math.min(frame, bakedData.totalFrames - 1);

  const frameState = bakedData.frames[clampedFrame];
  if (!frameState) return null;

  return frameState.bodies[bodyId] || null;
}
```

### PhysicsBody Component

```typescript
// packages/physics/src/components.tsx

import React from 'react';
import { usePhysicsBody } from './hooks';
import { BakedPhysics } from './types';

interface PhysicsBodyProps {
  data: BakedPhysics;
  bodyId: string;
  children: React.ReactNode;
  /** Offset to center the visual on the physics body */
  centerOffset?: { x: number; y: number };
}

export const PhysicsBody: React.FC<PhysicsBodyProps> = ({
  data,
  bodyId,
  children,
  centerOffset = { x: 0, y: 0 },
}) => {
  const state = usePhysicsBody(data, bodyId);

  if (!state) {
    return null;
  }

  const { position, angle } = state;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x + centerOffset.x,
        top: position.y + centerOffset.y,
        transform: `translate(-50%, -50%) rotate(${angle}rad)`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </div>
  );
};
```

### Physics Presets

```typescript
// packages/physics/src/presets.ts

import Matter from 'matter-js';

const { Bodies } = Matter;

export const PhysicsPresets = {
  // Material properties
  materials: {
    rubber: { restitution: 0.9, friction: 0.8 },
    metal: { restitution: 0.3, friction: 0.2, density: 2 },
    wood: { restitution: 0.4, friction: 0.6, density: 0.5 },
    ice: { restitution: 0.1, friction: 0.02 },
    superBouncy: { restitution: 1.0, friction: 0.1 },
  },

  // Gravity configurations
  gravity: {
    earth: { x: 0, y: 1 },
    moon: { x: 0, y: 0.166 },
    space: { x: 0, y: 0 },
    heavy: { x: 0, y: 2 },
    light: { x: 0, y: 0.5 },
  },

  // Factory functions for common static bodies
  createGround: (width: number, y: number = 1060, height: number = 40) =>
    Bodies.rectangle(width / 2, y, width, height, {
      isStatic: true,
      label: 'ground',
      friction: 0.8,
    }),

  createWalls: (width: number, height: number, thickness: number = 40) => [
    Bodies.rectangle(-thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      label: 'wall-left',
    }),
    Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      label: 'wall-right',
    }),
  ],

  createCeiling: (width: number, thickness: number = 40) =>
    Bodies.rectangle(width / 2, -thickness / 2, width, thickness, {
      isStatic: true,
      label: 'ceiling',
    }),

  createBox: (width: number, height: number) => [
    Bodies.rectangle(width / 2, height + 20, width, 40, { isStatic: true, label: 'ground' }),
    Bodies.rectangle(-20, height / 2, 40, height, { isStatic: true, label: 'wall-left' }),
    Bodies.rectangle(width + 20, height / 2, 40, height, { isStatic: true, label: 'wall-right' }),
  ],
};
```

### Package Exports

```typescript
// packages/physics/src/index.ts

export { bakePhysics } from './bake';
export { usePhysicsBody } from './hooks';
export { PhysicsBody } from './components';
export { PhysicsPresets } from './presets';
export * from './types';
```

## Complete Usage Example

What Claude generates for "a ball dropping and bouncing":

```tsx
import { AbsoluteFill } from 'remotion';
import { bakePhysics, PhysicsBody, PhysicsPresets } from '@clipify/physics';
import { Bodies, World } from 'matter-js';

// Bake physics once, outside component (runs at bundle time)
const bakedData = bakePhysics({
  fps: 30,
  duration: 4,
  worldConfig: {
    gravity: PhysicsPresets.gravity.earth,
    bounds: { width: 1920, height: 1080 },
  },
  setup: (world) => {
    // Dynamic body - the ball
    const ball = Bodies.circle(960, 100, 60, {
      ...PhysicsPresets.materials.rubber,
      label: 'ball',
    });

    // Static body - the ground
    const ground = PhysicsPresets.createGround(1920);

    World.add(world, [ball, ground]);
  },
});

export const BouncingBall: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      {/* Ball rendered at physics position */}
      <PhysicsBody data={bakedData} bodyId="ball">
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        />
      </PhysicsBody>

      {/* Ground (static, so we position manually) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 40,
          background: '#4a4a6a',
        }}
      />
    </AbsoluteFill>
  );
};
```

## Advanced Examples

### Projectile Motion (Throwing)

```tsx
const bakedData = bakePhysics({
  fps: 30,
  duration: 3,
  worldConfig: { gravity: PhysicsPresets.gravity.earth },
  setup: (world, engine) => {
    const ball = Bodies.circle(200, 800, 30, {
      ...PhysicsPresets.materials.rubber,
      label: 'projectile',
    });

    // Apply initial velocity for throwing arc
    Matter.Body.setVelocity(ball, { x: 15, y: -20 });

    const ground = PhysicsPresets.createGround(1920);
    World.add(world, [ball, ground]);
  },
});
```

### Stacking & Tumbling

```tsx
const bakedData = bakePhysics({
  fps: 30,
  duration: 5,
  worldConfig: { gravity: PhysicsPresets.gravity.earth },
  setup: (world) => {
    // Stack of boxes
    const boxes = [];
    for (let i = 0; i < 5; i++) {
      boxes.push(
        Bodies.rectangle(960, 900 - i * 80, 70, 70, {
          ...PhysicsPresets.materials.wood,
          label: `box-${i}`,
        })
      );
    }

    // Ball to knock them over
    const ball = Bodies.circle(200, 600, 40, {
      ...PhysicsPresets.materials.metal,
      label: 'ball',
    });
    Matter.Body.setVelocity(ball, { x: 12, y: 0 });

    const ground = PhysicsPresets.createGround(1920);
    World.add(world, [ball, ...boxes, ground]);
  },
});
```

### Multiple Colliding Objects

```tsx
const bakedData = bakePhysics({
  fps: 30,
  duration: 6,
  worldConfig: { gravity: PhysicsPresets.gravity.earth },
  setup: (world) => {
    // Rain of balls
    const balls = [];
    for (let i = 0; i < 10; i++) {
      balls.push(
        Bodies.circle(
          300 + Math.random() * 1300, // Random x
          -100 - Math.random() * 500,  // Start above screen
          20 + Math.random() * 30,     // Random size
          {
            ...PhysicsPresets.materials.rubber,
            label: `ball-${i}`,
          }
        )
      );
    }

    const [ground, ...walls] = [
      PhysicsPresets.createGround(1920),
      ...PhysicsPresets.createWalls(1920, 1080),
    ];

    World.add(world, [...balls, ground, ...walls]);
  },
});
```

## AI Agent Integration

### Agent Guide Document

Create `packages/physics/AGENT_GUIDE.md`:

```markdown
# Physics Animation Guide for AI Agent

## When to Use Physics

Use `@clipify/physics` when animating:
- Objects falling under gravity
- Bouncing or ricocheting motion
- Objects colliding with each other or surfaces
- Stacking, toppling, or tumbling
- Throwing or launching projectiles
- Any motion that should "feel" natural

## When NOT to Use Physics

Use regular Remotion `spring()` or `interpolate()` for:
- UI transitions (fade, slide, scale)
- Text animations
- Smooth point-A-to-point-B motion without collisions
- Easing-based effects
- Anything that doesn't involve realistic motion

## Quick Start

```tsx
import { bakePhysics, PhysicsBody, PhysicsPresets } from '@clipify/physics';
import { Bodies, World, Body } from 'matter-js';

const bakedData = bakePhysics({
  fps: 30,
  duration: 4,
  worldConfig: {
    gravity: PhysicsPresets.gravity.earth,
  },
  setup: (world) => {
    // Create bodies here
    const ball = Bodies.circle(x, y, radius, { label: 'ball', ...options });
    World.add(world, [ball]);
  },
});
```

## Body Types

| Function | Use Case |
|----------|----------|
| `Bodies.circle(x, y, radius, options)` | Balls, coins, wheels |
| `Bodies.rectangle(x, y, width, height, options)` | Boxes, platforms, walls |
| `Bodies.polygon(x, y, sides, radius, options)` | Triangles, hexagons |
| `Bodies.trapezoid(x, y, width, height, slope, options)` | Ramps, slopes |

## Common Options

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | **Required** - ID to reference in `<PhysicsBody>` |
| `isStatic` | boolean | `true` for immovable objects (ground, walls) |
| `restitution` | 0-1 | Bounciness (0.8 = bouncy ball, 0.1 = dead stop) |
| `friction` | 0-1 | Surface friction |
| `density` | number | Affects mass (default 0.001) |

## Material Presets

```tsx
PhysicsPresets.materials.rubber   // { restitution: 0.9, friction: 0.8 }
PhysicsPresets.materials.metal    // { restitution: 0.3, friction: 0.2, density: 2 }
PhysicsPresets.materials.wood     // { restitution: 0.4, friction: 0.6, density: 0.5 }
PhysicsPresets.materials.ice      // { restitution: 0.1, friction: 0.02 }
```

## Gravity Presets

```tsx
PhysicsPresets.gravity.earth  // { x: 0, y: 1 }
PhysicsPresets.gravity.moon   // { x: 0, y: 0.166 }
PhysicsPresets.gravity.space  // { x: 0, y: 0 }
PhysicsPresets.gravity.heavy  // { x: 0, y: 2 }
```

## Applying Forces & Velocity

```tsx
setup: (world, engine) => {
  const ball = Bodies.circle(200, 500, 40, { label: 'ball' });

  // Set initial velocity (for throwing)
  Body.setVelocity(ball, { x: 10, y: -15 });

  // Or apply a force (for explosions, impulses)
  Body.applyForce(ball, ball.position, { x: 0.05, y: -0.1 });

  World.add(world, [ball]);
};
```

## Helper Functions

```tsx
// Create ground at bottom of 1920x1080 canvas
PhysicsPresets.createGround(1920)

// Create left and right walls
PhysicsPresets.createWalls(1920, 1080)

// Create ceiling
PhysicsPresets.createCeiling(1920)

// Create enclosed box (ground + walls)
PhysicsPresets.createBox(1920, 1080)
```
```

### Agent Prompt Update

Add to the visual generation agent's system prompt:

```
## Physics Animations

For animations requiring realistic physics (falling, bouncing, collisions,
throwing), use the `@clipify/physics` package instead of manual interpolation.

Read `packages/physics/AGENT_GUIDE.md` for:
- When to use physics vs regular animation
- Body types and material presets
- Code patterns and examples

Key imports:
- `bakePhysics` - Pre-compute physics simulation
- `PhysicsBody` - Render component at physics position
- `PhysicsPresets` - Ready-made materials and helpers
- `Bodies, World, Body` from 'matter-js' - Create physics objects
```

## Implementation Steps

| # | Task | Description |
|---|------|-------------|
| 1 | Create package structure | `packages/physics/` with tsconfig, package.json |
| 2 | Install dependencies | `matter-js`, `@types/matter-js` |
| 3 | Implement `types.ts` | TypeScript interfaces |
| 4 | Implement `bake.ts` | Core baking function |
| 5 | Implement `hooks.ts` | `usePhysicsBody` hook |
| 6 | Implement `components.tsx` | `PhysicsBody` component |
| 7 | Implement `presets.ts` | Material and helper presets |
| 8 | Create `index.ts` | Public exports |
| 9 | Write `AGENT_GUIDE.md` | Documentation for AI agent |
| 10 | Update renderer package | Import `@clipify/physics` |
| 11 | Update agent prompt | Add physics guidance |
| 12 | Test with sample animations | Verify baking and rendering work |

## Testing Strategy

1. **Unit tests for bakePhysics**
   - Verify frame count matches duration * fps
   - Verify body positions change over time
   - Verify static bodies don't move

2. **Integration test**
   - Create a simple bouncing ball scene
   - Render with Remotion
   - Verify ball position at key frames (start, first bounce, settled)

3. **Visual regression**
   - Record reference videos for common physics scenarios
   - Compare future renders against references

## Future Enhancements

- **Constraints**: Springs, hinges, ropes connecting bodies
- **Sensors**: Trigger events when bodies enter regions
- **Compound bodies**: Complex shapes from multiple primitives
- **Debug rendering**: Visualize physics bodies during development
- **Performance optimization**: Web Worker for baking large simulations
