You are setting up the project foundation for a Remotion animation.

## YOUR TASK
1. Read SCENE_PLAN.md and scenes.json to understand the full plan
2. Create folder structure: components/ and scenes/ directories
3. Create constants.ts — COPY the motion token code block below VERBATIM, then add COLORS and TIMING from scenes.json
4. Create components/Background.tsx — the GENERIC Studio Dark background (see rules below)

## RULES
- constants.ts TIMING values MUST match scenes.json exactly
- Do NOT add OVERLAY_RANGES or global backgrounds in constants.ts/index.tsx — each scene handles its own background
- Background.tsx MUST be copied VERBATIM from the code block below — do NOT improvise or add topic-specific visuals
- Do NOT create any scene files — those will be created by separate agents
- Do NOT create index.tsx — that will be assembled later

## ⚠️ MANDATORY MOTION TOKENS — COPY-PASTE VERBATIM (DO NOT MODIFY, SIMPLIFY, OR RENAME)
The following code block MUST appear in constants.ts EXACTLY as written. Do NOT:
- ❌ Rename SPRINGS to SPRING_CONFIG or any other name
- ❌ Simplify to just {smooth, snappy} — ALL 7 presets are required
- ❌ Change any damping/stiffness/mass values
- ❌ Omit DURATION or STAGGER exports

Scene files will import `SPRINGS`, `STAGGER`, `DURATION` by name. If you rename them, ALL scenes will have import errors.

```ts
export const SPRING_CONFIG = { damping: 26, stiffness: 120, mass: 1.0 };

export const SPRINGS = {
  SNAPPY:  { damping: 18, stiffness: 180, mass: 0.8 },
  SMOOTH:  { damping: 26, stiffness: 120, mass: 1.0 },
  BOUNCY:  { damping: 12, stiffness: 200, mass: 1.0 },
  HEAVY:   { damping: 24, stiffness: 120, mass: 1.4 },
  STIFF:   { damping: 24, stiffness: 300, mass: 0.6 },
  GENTLE:  { damping: 14, stiffness: 80,  mass: 1.2 },
  OVERLAY: { damping: 32, stiffness: 50,  mass: 1.0 },
};

export const DURATION = {
  QUICK: 8,
  NORMAL: 15,
  SLOW: 30,
  DRAMATIC: 45,
};

export const STAGGER = {
  RAPID: 2,
  TIGHT: 4,
  NORMAL: 6,
  WIDE: 8,
  CASCADE: 10,
};
```

## CRITICAL: SYNC POINTS MUST BE LOCAL FRAME OFFSETS
All keySync and syncPoint frame values in TIMING MUST be pre-subtracted (absolute frame - scene start).
Scene components use `useCurrentFrame()` which returns 0-relative frames inside `<Sequence>`.
If sync values are stored as absolute frames, scenes will be BLANK.

```ts
// ✅ CORRECT — pre-computed local offsets:
scene2KeySync: 322 - 300, // = 22 (absolute 322 minus scene2Start 300)
scene2Sync_logo: 322 - 300, // = 22

// ❌ WRONG — absolute frame values:
scene2KeySync: 322, // Causes animation at frame 322 of a 600-frame scene (WAY too late)
```

## VERBATIM Background.tsx CODE — COPY EXACTLY

```tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { COLORS } from '../constants';

const DotGrid: React.FC<{ color: string; spacing: number }> = ({ color, spacing }) => {
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id="dot-grid" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={spacing / 2} cy={spacing / 2} r={3} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
};

export const Background: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <DotGrid color={COLORS.gridColor || 'rgba(255,255,255,0.04)'} spacing={80} />
    </AbsoluteFill>
  );
};
```

constants.ts MUST export `gridColor` in the COLORS object.

## REMOTION RULES FOR Background.tsx (CRITICAL)
- Background.tsx must be the VERBATIM code above — no creative additions
- Do NOT add topic-specific visuals to Background.tsx (pool lanes, tech grids, etc.)
- Topic-specific visuals belong in individual scene files

## OUTPUT
After creating constants.ts and components/Background.tsx:
1. Verify constants.ts contains `export const SPRINGS = {` (NOT `export const SPRING_CONFIG = {` as the main config)
2. Verify constants.ts contains `SNAPPY`, `SMOOTH`, `BOUNCY`, `HEAVY`, `STIFF`, `GENTLE`, `OVERLAY`
3. Verify constants.ts contains `export const STAGGER = {` and `export const DURATION = {`
4. If any are missing, fix constants.ts NOW before finishing
5. Respond: "SETUP COMPLETE"
