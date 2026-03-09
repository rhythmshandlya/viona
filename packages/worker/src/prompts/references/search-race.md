### Example: Algorithm Race (Linear vs Binary Search)

**What it demonstrates:** Parallel comparison, elimination regions, live counters
**Key insight:** Show BOTH algorithms simultaneously so viewer FEELS the difference

```tsx
// src/{{projectId}}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, spring } from 'remotion';

export const {{projectId}}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // 16 sorted elements, target at index 12
  const elements = Array.from({ length: 16 }, (_, i) => (i + 1) * 5);
  const targetIndex = 12;

  // === LINEAR: Slow crawl through every element ===
  const linearSpeed = 12; // frames per step
  const linearProgress = Math.floor(frame / linearSpeed);
  const linearCurrentIndex = Math.min(linearProgress, targetIndex);
  const linearFound = linearProgress >= targetIndex;

  // === BINARY: Divide & conquer - eliminates half each step ===
  const binarySteps = [
    { left: 0, right: 15, mid: 7 },   // Check middle, go right
    { left: 8, right: 15, mid: 11 },  // Check middle of right half
    { left: 12, right: 15, mid: 13 }, // Check middle, go left
    { left: 12, right: 12, mid: 12 }, // Found!
  ];
  const binarySpeed = 35;
  const binaryStepIndex = Math.min(Math.floor(frame / binarySpeed), binarySteps.length - 1);
  const binaryStep = binarySteps[binaryStepIndex];
  const binaryFound = binaryStepIndex === binarySteps.length - 1;

  // Responsive sizes
  const elementSize = { w: minDim * 0.045, h: minDim * 0.07 };
  const gap = minDim * 0.008;

  const renderRow = (isLinear: boolean) => (
    <div style={{ display: 'flex', gap, justifyContent: 'center' }}>
      {elements.map((val, i) => {
        const isCurrent = isLinear ? i === linearCurrentIndex : i === binaryStep.mid;
        const isEliminated = !isLinear && (i < binaryStep.left || i > binaryStep.right);
        const found = isLinear ? linearFound && i === targetIndex : binaryFound && i === targetIndex;

        return (
          <div key={i} style={{
            width: elementSize.w, height: elementSize.h,
            background: found ? '#22c55e' : isCurrent ? (isLinear ? '#ef4444' : '#22c55e') : '#2a2a4a',
            borderRadius: minDim * 0.008,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: height * 0.018, fontWeight: 600, color: '#fff',
            opacity: isEliminated ? 0.25 : 1,
            transform: `scale(${isCurrent || found ? 1.2 : isEliminated ? 0.85 : 1})`,
          }}>
            {val}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)' }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: minDim * 0.12 }}>
        {/* Linear row with counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <span style={{ fontSize: height * 0.055, fontWeight: 800, color: '#ef4444' }}>
            {Math.min(linearProgress + 1, targetIndex + 1)}
          </span>
          {renderRow(true)}
        </div>
        {/* Binary row with counter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.02 }}>
          <span style={{ fontSize: height * 0.055, fontWeight: 800, color: '#22c55e' }}>
            {binaryStepIndex + 1}
          </span>
          {renderRow(false)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
```
