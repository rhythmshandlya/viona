import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import type { ExplainerCycleProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Angle for the i-th node (0 = top / 12 o'clock, clockwise). */
function nodeAngle(index: number, total: number): number {
  return -Math.PI / 2 + (index / total) * 2 * Math.PI;
}

/** Point on circle at given angle. */
function circlePoint(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): { x: number; y: number } {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** SVG arc path from angle A to angle B (clockwise, always minor arc when
 *  the arc spans < PI, large-arc otherwise). */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = circlePoint(cx, cy, r, startAngle);
  const end = circlePoint(cx, cy, r, endAngle);
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Approximate arc length for a circular arc. */
function arcLength(r: number, startAngle: number, endAngle: number): number {
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  return r * sweep;
}

/* ── Component ────────────────────────────────────────────────────────────── */

const ExplainerCycle: React.FC<ExplainerCycleProps> = ({
  showBackground,
  title,
  stages = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const n = stages.length;

  // ── Layout ───────────────────────────────────────────────────────────────
  const cx = width / 2;
  const cy = height * 0.5; // vertical center
  const radius = s(300);
  const nodeRadius = s(28); // visual radius of each node circle
  const labelOffset = s(48); // how far labels sit from node center (radial)

  // ── Animation timeline ────────────────────────────────────────────────────
  const titleAnim = glowFadeIn(frame, 0, 10);

  // Arc drawing: frames 12-80 — each arc takes equal share
  const arcDrawStart = 12;
  const arcDrawEnd = 80;
  const arcFramesTotal = arcDrawEnd - arcDrawStart;
  const arcFramesPerSegment = arcFramesTotal / n;

  // Orbit: frames 75-130
  const orbitStart = 75;
  const orbitEnd = 130;
  const orbitPeriod = orbitEnd - orbitStart;

  // Exit: last 15 frames
  const exit = glowExit(frame, durationInFrames - 15);

  // ── Precompute angles & positions ─────────────────────────────────────────
  const angles = Array.from({ length: n }, (_, i) => nodeAngle(i, n));
  const points = angles.map((a) => circlePoint(cx, cy, radius, a));

  // ── Node appearance frames — each node appears when its incoming arc completes
  // First node appears at frame 8 (before arcs start).
  // Node i (i>=1) appears when arc (i-1)->i finishes.
  const nodeAppearFrame = (i: number) => {
    if (i === 0) return 8;
    return arcDrawStart + i * arcFramesPerSegment;
  };

  // ── Orbiting dot logic ────────────────────────────────────────────────────
  const orbitActive = frame >= orbitStart && frame <= orbitEnd;
  const orbitProgress = orbitActive
    ? (frame - orbitStart) / orbitPeriod
    : 0;
  const orbitAngle = -Math.PI / 2 + orbitProgress * 2 * Math.PI;
  const orbitDot = circlePoint(cx, cy, radius, orbitAngle);

  // Trail dots (3 behind main dot)
  const trailCount = 3;
  const trailSpacing = 0.035; // radians behind per trail dot
  const trailDots = Array.from({ length: trailCount }, (_, i) => {
    const tAngle = orbitAngle - (i + 1) * trailSpacing;
    return {
      ...circlePoint(cx, cy, radius, tAngle),
      opacity: 0.6 - i * 0.18,
      r: s(8) - (i + 1) * s(1.5),
    };
  });

  // ── Determine if the orbiting dot is near each node (for pulse) ──────────
  const nodePulseActive = (i: number): boolean => {
    if (!orbitActive) return false;
    const nAngle = angles[i];
    let diff = orbitAngle - nAngle;
    // Normalize diff to [-PI, PI]
    diff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return Math.abs(diff) < 0.25; // ~14 degrees
  };

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="cycle-bg" />}

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: s(140),
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          <div
            style={{
              fontFamily: BLACKBOARD_FONTS.heading,
              fontSize: s(52),
              fontWeight: 600,
              color: BLACKBOARD_COLORS.text,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              padding: `0 ${s(60)}px`,
            }}
          >
            {title}
          </div>
        </div>

        {/* ── SVG layer: arcs, arrows, orbit dot ───────────────────────── */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Arc segments */}
          {Array.from({ length: n }, (_, i) => {
            const fromAngle = angles[i];
            const toAngle = angles[(i + 1) % n];
            const d = arcPath(cx, cy, radius, fromAngle, toAngle);
            const len = arcLength(radius, fromAngle, toAngle);

            // Draw progress for this arc segment
            const segStart = arcDrawStart + i * arcFramesPerSegment;
            const segEnd = segStart + arcFramesPerSegment;
            const drawProgress = interpolate(
              frame,
              [segStart, segEnd],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
            );

            // Arrow at midpoint of arc
            const midAngle = fromAngle + ((toAngle - fromAngle + 2 * Math.PI) % (2 * Math.PI)) / 2;
            // If the midAngle wraps, correct it
            const arrowPos = circlePoint(cx, cy, radius, midAngle);
            // Tangent direction (perpendicular to radius, clockwise)
            const tangentAngle = midAngle + Math.PI / 2;
            const arrowSize = s(8);

            // Arrow visibility tracks arc draw
            const arrowOpacity = interpolate(
              drawProgress,
              [0.4, 0.6],
              [0, 0.7],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            return (
              <g key={`arc-${i}`}>
                {/* Arc path */}
                <path
                  d={d}
                  fill="none"
                  stroke={BLACKBOARD_COLORS.surfaceBorder}
                  strokeWidth={s(2)}
                  strokeDasharray={len}
                  strokeDashoffset={len * (1 - drawProgress)}
                  strokeLinecap="round"
                />
                {/* Arrow chevron at midpoint */}
                {arrowOpacity > 0 && (
                  <polygon
                    points={[
                      `${arrowPos.x + Math.cos(tangentAngle) * arrowSize},${arrowPos.y + Math.sin(tangentAngle) * arrowSize}`,
                      `${arrowPos.x + Math.cos(tangentAngle - 2.5) * arrowSize * 0.6},${arrowPos.y + Math.sin(tangentAngle - 2.5) * arrowSize * 0.6}`,
                      `${arrowPos.x + Math.cos(tangentAngle + 2.5) * arrowSize * 0.6},${arrowPos.y + Math.sin(tangentAngle + 2.5) * arrowSize * 0.6}`,
                    ].join(' ')}
                    fill={BLACKBOARD_COLORS.textDim}
                    opacity={arrowOpacity}
                  />
                )}
              </g>
            );
          })}

          {/* Orbiting dot + trail */}
          {orbitActive && (
            <>
              {trailDots.map((td, i) => (
                <circle
                  key={`trail-${i}`}
                  cx={td.x}
                  cy={td.y}
                  r={Math.max(td.r, 0)}
                  fill={BLACKBOARD_COLORS.primary}
                  opacity={td.opacity}
                />
              ))}
              <circle
                cx={orbitDot.x}
                cy={orbitDot.y}
                r={s(8)}
                fill={BLACKBOARD_COLORS.primary}
              />
            </>
          )}
        </svg>

        {/* ── Node circles (positioned absolutely) ─────────────────────── */}
        {stages.map((stage, i) => {
          const pt = points[i];
          const appear = nodeAppearFrame(i);

          // Scale-in animation
          const nodeScale = interpolate(
            frame,
            [appear, appear + 8],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4)) },
          );
          const nodeOpacity = interpolate(
            frame,
            [appear, appear + 6],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Pulse when orbit dot passes
          const isPulsing = nodePulseActive(i);
          const borderColor = isPulsing
            ? BLACKBOARD_COLORS.primary
            : BLACKBOARD_COLORS.surfaceBorder;

          // Label placement — push outward from center
          const angle = angles[i];
          const labelX = pt.x + Math.cos(angle) * labelOffset;
          const labelY = pt.y + Math.sin(angle) * labelOffset;

          // Text alignment based on position around circle
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          let textAlign: 'center' | 'left' | 'right' = 'center';
          let labelAnchorX = labelX;
          if (cosA > 0.3) {
            textAlign = 'left';
            labelAnchorX = labelX;
          } else if (cosA < -0.3) {
            textAlign = 'right';
            labelAnchorX = labelX;
          }

          const labelWidth = s(180);

          return (
            <React.Fragment key={i}>
              {/* Node circle */}
              <div
                style={{
                  position: 'absolute',
                  left: pt.x - nodeRadius,
                  top: pt.y - nodeRadius,
                  width: nodeRadius * 2,
                  height: nodeRadius * 2,
                  borderRadius: '50%',
                  backgroundColor: BLACKBOARD_COLORS.surface,
                  border: `${s(1.5)}px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${nodeScale})`,
                  opacity: nodeOpacity,
                  transition: 'border-color 0.15s ease',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: BLACKBOARD_FONTS.mono,
                    fontSize: s(22),
                    fontWeight: 700,
                    color: isPulsing
                      ? BLACKBOARD_COLORS.primary
                      : BLACKBOARD_COLORS.textMuted,
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
              </div>

              {/* Label */}
              <div
                style={{
                  position: 'absolute',
                  left: textAlign === 'center'
                    ? labelAnchorX - labelWidth / 2
                    : textAlign === 'left'
                      ? labelAnchorX
                      : labelAnchorX - labelWidth,
                  top: sinA < -0.5
                    ? labelY - s(52) // above node (top region)
                    : sinA > 0.5
                      ? labelY - s(4) // below node (bottom region)
                      : labelY - s(28), // side nodes — vertically centered
                  width: labelWidth,
                  textAlign,
                  opacity: nodeOpacity,
                  transform: `scale(${nodeScale})`,
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(22),
                    fontWeight: 600,
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.2,
                  }}
                >
                  {stage.label}
                </div>
                {stage.description && (
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(16),
                      fontWeight: 400,
                      color: BLACKBOARD_COLORS.textDim,
                      lineHeight: 1.3,
                      marginTop: s(2),
                    }}
                  >
                    {stage.description}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerCycle;
