### Example: Stack Overflow with Memory Pressure

**What it demonstrates:** Progressive tension, memory visualization, physics-based shake
**Key insight:** Visual stress (shake, color) increases as memory fills - viewer feels the crash coming

```tsx
// src/{{projectId}}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

export const {{projectId}}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  // Timeline
  const frameInterval = 8;
  const maxFrames = 14;
  const crashFrame = maxFrames * frameInterval;
  const currentStackDepth = Math.min(Math.floor(frame / frameInterval), maxFrames);
  const isCrashed = frame >= crashFrame;

  // Memory pressure (0 to 1)
  const memoryUsage = currentStackDepth / maxFrames;
  const memoryColor = memoryUsage > 0.85 ? '#ef4444' : memoryUsage > 0.6 ? '#f97316' : '#22c55e';

  // Shake increases with memory pressure
  const shakeIntensity = interpolate(memoryUsage, [0.7, 1], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const shakeX = isCrashed ? 0 : Math.sin(frame * 1.5) * shakeIntensity * minDim * 0.008;
  const shakeY = isCrashed ? 0 : Math.cos(frame * 1.8) * shakeIntensity * minDim * 0.005;

  // Stack frames
  const stackFrames = Array.from({ length: currentStackDepth }, (_, i) => ({
    id: i, name: 'fib', arg: maxFrames - i,
  }));

  const stackWidth = width * 0.45;
  const frameHeight = height * 0.05;

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0f0f23 70%)' }}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: minDim * 0.08,
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}>
        {/* Stack visualization */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: height * 0.008 }}>
          {stackFrames.map((sf) => {
            const entryProgress = spring({ frame: frame - sf.id * frameInterval, fps, config: { damping: 12, stiffness: 100 } });
            const stressLevel = sf.id / maxFrames;
            return (
              <div key={sf.id} style={{
                width: stackWidth * 0.9, height: frameHeight,
                background: 'linear-gradient(135deg, #8b5cf622 0%, #8b5cf611 100%)',
                border: `${Math.max(1, minDim * 0.002)}px solid #a78bfa`,
                borderRadius: minDim * 0.01,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${entryProgress})`,
                opacity: entryProgress,
                boxShadow: stressLevel > 0.7 ? `0 0 ${minDim * 0.015}px #ef444466` : 'none',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: height * 0.022, color: '#a78bfa' }}>
                  {sf.name}({sf.arg})
                </span>
              </div>
            );
          })}
        </div>

        {/* Memory bar */}
        <div style={{
          width: width * 0.08, height: height * 0.7,
          background: '#1a1a2e', borderRadius: minDim * 0.015,
          border: `${Math.max(1, minDim * 0.002)}px solid #333`,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        }}>
          <div style={{
            width: '100%', height: `${memoryUsage * 100}%`,
            background: memoryColor, borderRadius: minDim * 0.01,
            boxShadow: `0 0 ${minDim * 0.025}px ${memoryColor}66`,
          }} />
        </div>
      </div>

      {/* Depth counter */}
      <div style={{ position: 'absolute', bottom: minDim * 0.05, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontSize: height * 0.05, fontWeight: 800, color: memoryColor }}>
          {currentStackDepth}
        </span>
        <span style={{ fontSize: height * 0.022, color: '#888', marginLeft: minDim * 0.015 }}>
          frames deep
        </span>
      </div>
    </AbsoluteFill>
  );
};
```
