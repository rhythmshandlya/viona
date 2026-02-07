import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';

interface Scene6Props {
  startFrame?: number;
}

// Simple wheel ring component
const WheelRing: React.FC<{
  size: number;
  rotation: number;
  slotCount: number;
  color: string;
  label: string;
  opacity: number;
}> = ({ size, rotation, slotCount, color, label, opacity }) => {
  const outerRadius = size / 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '45%',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        width: size,
        height: size,
        opacity,
      }}
    >
      {/* Ring */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: `4px solid ${color}`,
          boxShadow: `0 0 25px ${color}55, inset 0 0 20px ${color}22`,
          background: 'transparent',
        }}
      />

      {/* Slot ticks */}
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
          const isMajor = i % (slotCount / 12) === 0;
          const tickStart = outerRadius - 5;
          const tickEnd = tickStart - (isMajor ? 20 : 10);

          const x1 = outerRadius + tickStart * Math.cos(angle);
          const y1 = outerRadius + tickStart * Math.sin(angle);
          const x2 = outerRadius + tickEnd * Math.cos(angle);
          const y2 = outerRadius + tickEnd * Math.sin(angle);

          return (
            <line
              key={`tick-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={isMajor ? 3 : 1.5}
              opacity={isMajor ? 1 : 0.5}
            />
          );
        })}
      </svg>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
          fontSize: size * 0.08,
          fontWeight: 700,
          color,
          fontFamily: 'system-ui, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 2,
          textShadow: `0 0 10px ${color}88`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
};

// Cascade particle flowing between wheels
const CascadeParticle: React.FC<{
  startFrame: number;
  outerRadius: number;
  innerRadius: number;
  sourceSlot: number;
  targetSlot: number;
}> = ({ startFrame, outerRadius, innerRadius, sourceSlot, targetSlot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;
  if (localFrame < 0 || localFrame > 60) return null;

  // Cascade animation
  const progress = spring({
    frame: localFrame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
  });

  // Source position on outer wheel
  const sourceAngle = ((sourceSlot / 12) * 360 - 90) * (Math.PI / 180);
  const sourceX = Math.cos(sourceAngle) * outerRadius * 0.85;
  const sourceY = Math.sin(sourceAngle) * outerRadius * 0.85;

  // Target position on inner wheel
  const targetAngle = ((targetSlot / 60) * 360 - 90) * (Math.PI / 180);
  const targetX = Math.cos(targetAngle) * innerRadius * 0.65;
  const targetY = Math.sin(targetAngle) * innerRadius * 0.65;

  // Current position
  const x = sourceX + (targetX - sourceX) * progress;
  const y = sourceY + (targetY - sourceY) * progress;

  const opacity = interpolate(localFrame, [0, 10, 50, 60], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const size = 20 + (1 - progress) * 10;

  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(50% + ${x}px)`,
        top: `calc(45% + ${y}px)`,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${COLORS.success}, ${COLORS.primary})`,
        boxShadow: `0 0 ${size}px ${COLORS.success}88`,
        transform: 'translate(-50%, -50%)',
        opacity,
        zIndex: 30,
      }}
    />
  );
};

export const Scene6: React.FC<Scene6Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const innerWheelSize = width * 0.4;
  const outerWheelSize = width * 0.75;

  // Outer wheel slide-in animation
  const outerWheelAppear = spring({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 50 },
  });

  // Inner wheel already present
  const innerWheelOpacity = interpolate(frame, [0, 20], [0.5, 1], { extrapolateRight: 'clamp' });

  // Rotation speeds (outer slower than inner)
  const innerRotation = (frame * 0.3) % 360;
  const outerRotation = (frame * 0.1) % 360;

  // Cascade events
  const cascadeEvents = [
    { startFrame: 80, sourceSlot: 0, targetSlot: 0 },
    { startFrame: 180, sourceSlot: 3, targetSlot: 15 },
    { startFrame: 280, sourceSlot: 6, targetSlot: 30 },
    { startFrame: 380, sourceSlot: 9, targetSlot: 45 },
  ];

  return (
    <AbsoluteFill>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '4%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 38,
          fontWeight: 800,
          color: COLORS.primary,
          fontFamily: 'system-ui, sans-serif',
          textShadow: `0 0 20px ${COLORS.primary}66`,
          opacity: interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' }),
          textAlign: 'center',
        }}
      >
        HIERARCHICAL TIMING WHEELS
      </div>

      {/* Outer wheel (minutes) */}
      <WheelRing
        size={outerWheelSize}
        rotation={outerRotation}
        slotCount={12}
        color={COLORS.secondary}
        label="MINUTES"
        opacity={Math.max(0, outerWheelAppear)}
      />

      {/* Inner wheel (seconds) */}
      <WheelRing
        size={innerWheelSize}
        rotation={innerRotation}
        slotCount={60}
        color={COLORS.primary}
        label="SECONDS"
        opacity={innerWheelOpacity}
      />

      {/* Center hub */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
          boxShadow: `0 0 30px ${COLORS.primary}`,
          zIndex: 20,
        }}
      />

      {/* Cascade particles */}
      {cascadeEvents.map((event, i) => (
        <CascadeParticle
          key={`cascade-${i}`}
          startFrame={event.startFrame}
          outerRadius={outerWheelSize / 2}
          innerRadius={innerWheelSize / 2}
          sourceSlot={event.sourceSlot}
          targetSlot={event.targetSlot}
        />
      ))}

      {/* Connection arrows */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: interpolate(frame, [50, 80], [0, 0.6], { extrapolateRight: 'clamp' }),
        }}
      >
        {/* Arrow from outer to inner */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.success} />
          </marker>
        </defs>
        <line
          x1="50%"
          y1={`calc(45% - ${outerWheelSize / 2 - 30}px)`}
          x2="50%"
          y2={`calc(45% - ${innerWheelSize / 2 + 20}px)`}
          stroke={COLORS.success}
          strokeWidth={3}
          markerEnd="url(#arrowhead)"
          strokeDasharray="8 4"
        />
      </svg>

      {/* Explanation box */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '85%',
          padding: '24px 30px',
          background: `${COLORS.dark}ee`,
          border: `2px solid ${COLORS.success}44`,
          borderRadius: 16,
          opacity: interpolate(frame, [100, 140], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.success,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Cascade Mechanism
        </div>
        <div
          style={{
            fontSize: 20,
            color: COLORS.gray,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          When the minute wheel ticks, tasks cascade down to the second wheel.
          <br />
          Handle any duration with constant-time operations!
        </div>
      </div>

      {/* Time labels */}
      <div
        style={{
          position: 'absolute',
          right: '5%',
          top: '25%',
          padding: '12px 20px',
          background: `${COLORS.secondary}33`,
          border: `2px solid ${COLORS.secondary}`,
          borderRadius: 12,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.secondary,
          fontFamily: 'system-ui, sans-serif',
          opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        1-60 minutes
      </div>
      <div
        style={{
          position: 'absolute',
          left: '5%',
          top: '50%',
          padding: '12px 20px',
          background: `${COLORS.primary}33`,
          border: `2px solid ${COLORS.primary}`,
          borderRadius: 12,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.primary,
          fontFamily: 'system-ui, sans-serif',
          opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        0-59 seconds
      </div>
    </AbsoluteFill>
  );
};

export default Scene6;
