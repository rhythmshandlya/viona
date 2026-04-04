import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerOrbitProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Clamp-safe interpolate shorthand. */
function lerp(
  frame: number,
  inputRange: [number, number],
  outputRange: [number, number],
  easing?: (t: number) => number,
): number {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/** Orbit ring radii (1080-based pixel values). */
const RING_RADII = [180, 300, 420];

/** Rotation speed: radians per frame. Inner fastest, outer slowest. */
const RING_SPEEDS = [
  (2 * Math.PI) / 120, // inner: full rotation in 120 frames
  (2 * Math.PI) / 180, // middle: full rotation in 180 frames
  (2 * Math.PI) / 240, // outer: full rotation in 240 frames
];

/** Ring accent colors. */
const RING_COLORS = [
  BLACKBOARD_COLORS.primary,
  BLACKBOARD_COLORS.secondary,
  BLACKBOARD_COLORS.surfaceBorder,
];

/* ─── Orbit Ring (SVG dashed circle with draw-in animation) ──────────── */

function OrbitRing({
  cx,
  cy,
  radius,
  progress,
  strokeColor,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  radius: number;
  progress: number;
  strokeColor: string;
  strokeWidth: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const dashOffset = interpolate(progress, [0, 1], [circumference, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeDasharray={`6 4`}
      strokeDashoffset={dashOffset}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

/* ─── Connecting Line (SVG dashed line from center to orbiting element) ── */

function ConnectingLine({
  x1,
  y1,
  x2,
  y2,
  opacity,
  strokeWidth,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  strokeWidth: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={BLACKBOARD_COLORS.surfaceBorder}
      strokeWidth={strokeWidth}
      strokeDasharray="4 6"
      opacity={opacity}
    />
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

const ExplainerOrbit: React.FC<ExplainerOrbitProps> = ({
  showBackground,
  title,
  center,
  rings = [],
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();

  // ── Layout constants ────────────────────────────────────────────────────
  const cx = width / 2;
  const cy = height * 0.47;
  const centerNodeSize = s(90);
  const orbitElementSize = s(48);
  const ringCount = Math.min(rings.length, 3);

  // ── Animation timeline ──────────────────────────────────────────────────

  // Title fade in: frames 0-10
  const titleAnim = glowFadeIn(frame, 0, 10);

  // Center node scale in: frames 5-18
  const centerScale = lerp(frame, [5, 18], [0, 1], Easing.out(Easing.back(1.4)));
  const centerOpacity = lerp(frame, [5, 13], [0, 1]);

  // Orbit rings draw in: staggered starting at frame 12
  const ringDrawStarts = [12, 18, 24];
  const ringDrawDuration = 13;

  // Orbiting elements appear: staggered starting at frame 20
  const elementAppearStart = 20;
  const elementStagger = 4; // frames between each element appearing

  // Connecting lines fade in: frames 60-70
  const connectLineOpacity = lerp(frame, [60, 70], [0, 0.15]);

  // Exit fade: frames 135-150
  const exit = glowExit(frame, 135, 15);

  // ── Flatten all elements with ring index for staggered appearance ──────
  type OrbitElement = { label: string; ringIndex: number; itemIndex: number; totalInRing: number };
  const allElements: OrbitElement[] = [];
  for (let ri = 0; ri < ringCount; ri++) {
    const items = rings[ri].items ?? [];
    for (let ii = 0; ii < items.length; ii++) {
      allElements.push({
        label: items[ii],
        ringIndex: ri,
        itemIndex: ii,
        totalInRing: items.length,
      });
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="orbit-bg" />}

        {/* ── Title ────────────────────────────────────────────────────── */}
        {title && (
          <div
            style={{
              position: 'absolute',
              top: s(80),
              left: s(40),
              right: s(40),
              textAlign: 'center',
              opacity: titleAnim.contentProgress,
              transform: `scale(${titleAnim.scale})`,
            }}
          >
            <div
              style={{
                fontFamily: BLACKBOARD_FONTS.heading,
                fontSize: s(42),
                fontWeight: 600,
                color: BLACKBOARD_COLORS.text,
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
              }}
            >
              {title}
            </div>
          </div>
        )}

        {/* ── SVG Layer: Orbit rings + connecting lines ─────────────────── */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Orbit rings */}
          {Array.from({ length: ringCount }).map((_, ri) => {
            const ringProgress = lerp(
              frame,
              [ringDrawStarts[ri], ringDrawStarts[ri] + ringDrawDuration],
              [0, 1],
              Easing.out(Easing.cubic),
            );

            return (
              <OrbitRing
                key={`ring-${ri}`}
                cx={cx}
                cy={cy}
                radius={s(RING_RADII[ri])}
                progress={ringProgress}
                strokeColor={BLACKBOARD_COLORS.surfaceBorder}
                strokeWidth={s(1)}
              />
            );
          })}

          {/* Connecting lines from center to each orbiting element */}
          {connectLineOpacity > 0 &&
            allElements.map((el, flatIdx) => {
              const radius = s(RING_RADII[el.ringIndex]);
              const speed = RING_SPEEDS[el.ringIndex];
              const startAngle = (2 * Math.PI * el.itemIndex) / el.totalInRing - Math.PI / 2;
              const angle = startAngle + frame * speed;
              const elX = cx + radius * Math.cos(angle);
              const elY = cy + radius * Math.sin(angle);

              return (
                <ConnectingLine
                  key={`connect-${flatIdx}`}
                  x1={cx}
                  y1={cy}
                  x2={elX}
                  y2={elY}
                  opacity={connectLineOpacity}
                  strokeWidth={s(1)}
                />
              );
            })}
        </svg>

        {/* ── Center Node ───────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: cx - centerNodeSize / 2,
            top: cy - centerNodeSize / 2,
            width: centerNodeSize,
            height: centerNodeSize,
            borderRadius: '50%',
            backgroundColor: BLACKBOARD_COLORS.surface,
            border: `${s(2)}px solid ${BLACKBOARD_COLORS.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: centerOpacity,
            transform: `scale(${centerScale})`,
          }}
        >
          <div
            style={{
              fontFamily: BLACKBOARD_FONTS.body,
              fontSize: s(15),
              fontWeight: 600,
              color: BLACKBOARD_COLORS.text,
              textAlign: 'center',
              lineHeight: 1.15,
              padding: s(6),
            }}
          >
            {center}
          </div>
        </div>

        {/* ── Orbiting Elements ──────────────────────────────────────────── */}
        {allElements.map((el, flatIdx) => {
          const radius = s(RING_RADII[el.ringIndex]);
          const speed = RING_SPEEDS[el.ringIndex];
          const startAngle = (2 * Math.PI * el.itemIndex) / el.totalInRing - Math.PI / 2;

          // Element appearance: staggered scale-in
          const appearFrame = elementAppearStart + flatIdx * elementStagger;
          const elScale = lerp(
            frame,
            [appearFrame, appearFrame + 12],
            [0, 1],
            Easing.out(Easing.back(1.3)),
          );
          const elOpacity = lerp(frame, [appearFrame, appearFrame + 8], [0, 1]);

          // Continuous orbit position
          const angle = startAngle + frame * speed;
          const elX = cx + radius * Math.cos(angle);
          const elY = cy + radius * Math.sin(angle);

          // Ring-specific border color
          const borderColor = RING_COLORS[el.ringIndex];

          return (
            <div
              key={`element-${flatIdx}`}
              style={{
                position: 'absolute',
                left: elX - orbitElementSize / 2,
                top: elY - orbitElementSize / 2,
                width: orbitElementSize,
                height: orbitElementSize,
                borderRadius: '50%',
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `${s(1)}px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: elOpacity,
                transform: `scale(${elScale})`,
              }}
            >
              {/* Label below the orbiting circle */}
              <div
                style={{
                  position: 'absolute',
                  top: orbitElementSize + s(4),
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(14),
                  fontWeight: 500,
                  color: BLACKBOARD_COLORS.textMuted,
                  textAlign: 'center',
                }}
              >
                {el.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerOrbit;
