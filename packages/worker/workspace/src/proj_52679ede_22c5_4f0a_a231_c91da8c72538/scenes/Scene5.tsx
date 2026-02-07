import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';

interface Scene5Props {
  startFrame?: number;
}

// Task orb that drops into a specific slot
const DroppingTask: React.FC<{
  targetSlot: number;
  startFrame: number;
  wheelRadius: number;
  centerX: number;
  centerY: number;
}> = ({ targetSlot, startFrame, wheelRadius, centerX, centerY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  // Calculate target position
  const angle = ((targetSlot / 60) * 360 - 90) * (Math.PI / 180);
  const slotRadius = wheelRadius * 0.65;
  const targetX = centerX + slotRadius * Math.cos(angle);
  const targetY = centerY + slotRadius * Math.sin(angle);

  // Drop animation
  const dropProgress = spring({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 100 },
  });

  const startY = centerY - wheelRadius - 100;
  const currentX = centerX + (targetX - centerX) * dropProgress;
  const currentY = startY + (targetY - startY) * dropProgress;

  // Glow on landing
  const glowIntensity = interpolate(
    localFrame,
    [20, 30, 50],
    [0, 1, 0.3],
    { extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(localFrame, [0, 5], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <>
      {/* The orb */}
      <div
        style={{
          position: 'absolute',
          left: currentX - 15,
          top: currentY - 15,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
          boxShadow: `0 0 ${15 + glowIntensity * 25}px ${COLORS.primary}`,
          opacity,
          zIndex: 20,
        }}
      />

      {/* Landing highlight on slot */}
      {dropProgress > 0.9 && (
        <div
          style={{
            position: 'absolute',
            left: targetX - 25,
            top: targetY - 25,
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: `3px solid ${COLORS.success}`,
            opacity: glowIntensity,
            boxShadow: `0 0 20px ${COLORS.success}88`,
          }}
        />
      )}
    </>
  );
};

// Enhanced timing wheel with numbered slots
const DetailedTimingWheel: React.FC<{
  size: number;
  rotation: number;
  assemblyProgress: number;
}> = ({ size, rotation, assemblyProgress }) => {
  const frame = useCurrentFrame();
  const slotCount = 60;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.5;
  const slotRadius = outerRadius * 0.65;

  // Clock hand rotation
  const handRotation = (frame * 0.5) % 360;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '42%',
        transform: `translate(-50%, -50%) scale(${assemblyProgress})`,
        width: size,
        height: size,
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `5px solid ${COLORS.primary}`,
          boxShadow: `
            0 0 30px ${COLORS.primary}66,
            inset 0 0 40px ${COLORS.primary}22
          `,
          background: `radial-gradient(circle at center, ${COLORS.dark}ee, ${COLORS.secondary}15)`,
        }}
      />

      {/* Slot markers and numbers */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {Array.from({ length: slotCount }).map((_, i) => {
          const angle = ((i / slotCount) * 360 - 90) * (Math.PI / 180);
          const isMajor = i % 5 === 0;

          // Tick marks
          const tickStart = outerRadius - 10;
          const tickEnd = tickStart - (isMajor ? 25 : 12);
          const x1 = outerRadius + tickStart * Math.cos(angle);
          const y1 = outerRadius + tickStart * Math.sin(angle);
          const x2 = outerRadius + tickEnd * Math.cos(angle);
          const y2 = outerRadius + tickEnd * Math.sin(angle);

          // Number position
          const numRadius = outerRadius - 55;
          const numX = outerRadius + numRadius * Math.cos(angle);
          const numY = outerRadius + numRadius * Math.sin(angle);

          // Staggered appearance
          const stagger = i * 0.5;
          const tickOpacity = interpolate(
            assemblyProgress,
            [0.3 + stagger / 100, 0.5 + stagger / 100],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <g key={`slot-${i}`} opacity={tickOpacity}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMajor ? COLORS.primary : COLORS.gray}
                strokeWidth={isMajor ? 3 : 1.5}
              />
              {isMajor && (
                <text
                  x={numX}
                  y={numY}
                  fill={COLORS.primary}
                  fontSize={18}
                  fontWeight={600}
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {i}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Inner circle for slot placement zone */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: innerRadius * 2,
          height: innerRadius * 2,
          borderRadius: '50%',
          border: `2px dashed ${COLORS.primary}44`,
          background: `radial-gradient(circle at center, ${COLORS.dark}dd, transparent)`,
        }}
      />

      {/* Center hub */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
          boxShadow: `0 0 20px ${COLORS.primary}`,
        }}
      />

      {/* Rotating clock hand */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 6,
          height: slotRadius,
          background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.success})`,
          borderRadius: 3,
          transformOrigin: 'bottom center',
          transform: `translateX(-50%) translateY(-100%) rotate(${handRotation}deg)`,
          boxShadow: `0 0 15px ${COLORS.primary}88`,
        }}
      />

      {/* O(1) label in center */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, 60px)',
          fontSize: 28,
          fontWeight: 800,
          color: COLORS.success,
          fontFamily: 'monospace',
          textShadow: `0 0 15px ${COLORS.success}88`,
          opacity: assemblyProgress > 0.8 ? 1 : 0,
        }}
      >
        O(1)
      </div>
    </div>
  );
};

export const Scene5: React.FC<Scene5Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const centerX = width / 2;
  const centerY = height * 0.42;
  const wheelRadius = 280;

  // Assembly animation - starts immediately
  const assemblyProgress = spring({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
  });

  // Task drop schedule
  const taskDrops = [
    { slot: 12, startFrame: 50 },
    { slot: 35, startFrame: 100 },
    { slot: 7, startFrame: 150 },
    { slot: 48, startFrame: 200 },
    { slot: 22, startFrame: 250 },
  ];

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 40,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: 'system-ui, sans-serif',
          textShadow: `0 0 20px ${COLORS.primary}66`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        60-SLOT TIMING WHEEL
      </div>

      {/* The detailed timing wheel */}
      <DetailedTimingWheel
        size={wheelRadius * 2}
        rotation={0}
        assemblyProgress={Math.max(0, assemblyProgress)}
      />

      {/* Dropping tasks */}
      {taskDrops.map((task, i) => (
        <DroppingTask
          key={`task-${i}`}
          targetSlot={task.slot}
          startFrame={task.startFrame}
          wheelRadius={wheelRadius}
          centerX={centerX}
          centerY={centerY}
        />
      ))}

      {/* Explanation text */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          padding: '20px 30px',
          background: `${COLORS.dark}dd`,
          border: `2px solid ${COLORS.primary}44`,
          borderRadius: 16,
          opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: COLORS.white,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Direct Placement
        </div>
        <div
          style={{
            fontSize: 22,
            color: COLORS.gray,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          Tasks go directly to their time slot - no sorting needed!
        </div>
      </div>

      {/* Task counter */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 40,
        }}
      >
        <div
          style={{
            padding: '12px 24px',
            background: `${COLORS.dark}ee`,
            border: `2px solid ${COLORS.success}`,
            borderRadius: 12,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.success,
            fontFamily: 'monospace',
            opacity: interpolate(frame, [100, 130], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          Insert: O(1)
        </div>
        <div
          style={{
            padding: '12px 24px',
            background: `${COLORS.dark}ee`,
            border: `2px solid ${COLORS.success}`,
            borderRadius: 12,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.success,
            fontFamily: 'monospace',
            opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          Remove: O(1)
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Scene5;
