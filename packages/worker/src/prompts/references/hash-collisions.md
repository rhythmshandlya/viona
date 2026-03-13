### Example: Hash Collisions with Physics

**What it demonstrates:** Gravity, bouncing, collision stacking, lookup traversal
**Key insight:** Balls pile up in buckets - lookup must scan through stack (O(n) vs O(1))

```tsx
// src/{{projectId}}/index.tsx
import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';

// Use simulateBallPhysics from COMMON_PATTERNS

export const {{projectId}}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  const numBuckets = 6;
  const ballRadius = minDim * 0.035;
  const bucketWidth = minDim * 0.11;
  const bucketHeight = height * 0.45;

  // Balls with intentional collisions in bucket 2
  const balls = [
    { id: 0, bucketIndex: 0, dropFrame: 15, stackPos: 0, color: '#8b5cf6' },
    { id: 1, bucketIndex: 2, dropFrame: 30, stackPos: 0, color: '#3b82f6' },
    { id: 2, bucketIndex: 4, dropFrame: 45, stackPos: 0, color: '#06b6d4' },
    { id: 3, bucketIndex: 2, dropFrame: 60, stackPos: 1, color: '#22c55e' },  // Collision!
    { id: 4, bucketIndex: 1, dropFrame: 75, stackPos: 0, color: '#f97316' },
    { id: 5, bucketIndex: 2, dropFrame: 90, stackPos: 2, color: '#ef4444' },  // Collision!
    { id: 6, bucketIndex: 2, dropFrame: 120, stackPos: 3, color: '#eab308' }, // Collision!
  ];

  // Lookup animation - scanning bucket 2
  const lookupStart = 150;
  const lookupProgress = interpolate(frame - lookupStart, [0, 30, 60, 90], [0, 1, 2, 3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const lookupComplete = frame > lookupStart + 100;

  const totalWidth = numBuckets * bucketWidth + (numBuckets - 1) * minDim * 0.02;
  const startX = (width - totalWidth) / 2;
  const bucketY = height * 0.75;

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at top, #1a1a3e 0%, #0f0f23 70%)' }}>
      {/* Buckets */}
      {Array.from({ length: numBuckets }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: startX + i * (bucketWidth + minDim * 0.02),
          top: bucketY - bucketHeight,
          width: bucketWidth, height: bucketHeight,
          background: '#1e293b',
          border: `${Math.max(2, minDim * 0.003)}px solid ${frame >= lookupStart && i === 2 ? '#3b82f6' : '#475569'}`,
          borderTop: 'none',
          borderRadius: `0 0 ${minDim * 0.015}px ${minDim * 0.015}px`,
        }} />
      ))}

      {/* Falling balls */}
      {balls.map((ball) => {
        if (frame < ball.dropFrame) return null;
        const bucketX = startX + ball.bucketIndex * (bucketWidth + minDim * 0.02) + bucketWidth / 2;
        const targetY = bucketY - ballRadius - ball.stackPos * ballRadius * 2.2;

        // Simple physics approximation (use full simulateBallPhysics for production)
        const elapsed = frame - ball.dropFrame;
        const fallDuration = 25;
        const y = elapsed < fallDuration
          ? interpolate(elapsed, [0, fallDuration], [-ballRadius * 2, targetY], { extrapolateRight: 'clamp' })
          : targetY;

        const isBeingChecked = frame >= lookupStart && ball.bucketIndex === 2 && Math.floor(lookupProgress) === ball.stackPos;

        return (
          <div key={ball.id} style={{
            position: 'absolute',
            left: bucketX - ballRadius, top: y - ballRadius,
            width: ballRadius * 2, height: ballRadius * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${ball.color}, ${ball.color}88)`,
            boxShadow: isBeingChecked ? `0 0 ${minDim * 0.03}px #3b82f6` : 'none',
            border: isBeingChecked ? `${Math.max(2, minDim * 0.004)}px solid #3b82f6` : 'none',
          }} />
        );
      })}

      {/* Stats */}
      <div style={{ position: 'absolute', top: minDim * 0.05, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: minDim * 0.1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: height * 0.045, fontWeight: 800, color: '#ef4444' }}>3</div>
          <div style={{ fontSize: height * 0.02, color: '#888' }}>collisions</div>
        </div>
        {frame >= lookupStart && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: height * 0.045, fontWeight: 800, color: lookupComplete ? '#22c55e' : '#3b82f6' }}>
              {Math.min(Math.floor(lookupProgress) + 1, 4)}
            </div>
            <div style={{ fontSize: height * 0.02, color: '#888' }}>checks to find</div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
```
