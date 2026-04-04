import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerNetworkProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Compute satellite positions evenly around a circle. */
function getSatellitePositions(
  cx: number,
  cy: number,
  radius: number,
  count: number,
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Start from top (-PI/2) so the first node is at 12 o'clock
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return positions;
}

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

/* ─── Connection Line (SVG) ──────────────────────────────────────────────── */

function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  progress,
  strokeWidth,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  strokeWidth: number;
  color: string;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const dashOffset = interpolate(progress, [0, 1], [length, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={length}
      strokeDashoffset={dashOffset}
    />
  );
}

/* ─── Traveling Pulse Dot (SVG) ──────────────────────────────────────────── */

function PulseDot({
  x1,
  y1,
  x2,
  y2,
  frame,
  startFrame,
  period,
  phaseOffset,
  radius,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  startFrame: number;
  period: number;
  phaseOffset: number;
  radius: number;
  color: string;
}) {
  if (frame < startFrame) return null;

  const elapsed = frame - startFrame + phaseOffset;
  const t = (elapsed % period) / period;
  const dotX = x1 + (x2 - x1) * t;
  const dotY = y1 + (y2 - y1) * t;

  return <circle cx={dotX} cy={dotY} r={radius} fill={color} opacity={0.85} />;
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

const ExplainerNetwork: React.FC<ExplainerNetworkProps> = ({
  showBackground,
  title,
  center,
  nodes = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  // ── Layout constants ────────────────────────────────────────────────────
  const cx = width / 2; // Center X
  const cy = height * 0.47; // Center Y (slightly above true center for portrait)
  const satelliteRadius = s(350);
  const centerNodeSize = s(80);
  const satelliteNodeSize = s(56);
  const nodeCount = nodes.length;

  const satellites = getSatellitePositions(cx, cy, satelliteRadius, nodeCount);

  // ── Animation timeline ──────────────────────────────────────────────────

  // Title fade in: frames 0-10
  const titleAnim = glowFadeIn(frame, 0, 10);

  // Center node scale in: frames 5-20
  const centerScale = lerp(frame, [5, 20], [0, 1], Easing.out(Easing.back(1.4)));
  const centerOpacity = lerp(frame, [5, 15], [0, 1]);

  // Radial lines draw from center to satellites: frames 15-50, staggered by 5
  const lineStagger = 5;
  const lineDrawDuration = 20;

  // Satellite scale in: synced with line completion
  const satelliteScaleDuration = 12;

  // Cross-connection lines between adjacent satellites: frames 55-70
  const crossLineStart = 55;
  const crossLineDuration = 15;

  // Pulse dots: frames 65-125
  const pulseStart = 65;
  const pulsePeriod = 40; // frames for one full trip

  // Exit fade: frames 135-150
  const exit = glowExit(frame, 135, 15);

  // ── Build cross-connections (adjacent satellite pairs) ──────────────────
  const crossConnections: { from: number; to: number }[] = [];
  for (let i = 0; i < nodeCount; i++) {
    crossConnections.push({ from: i, to: (i + 1) % nodeCount });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="network-bg" />}

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

        {/* ── SVG Layer: All connections and pulse dots ─────────────────── */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Radial connection lines: center → each satellite */}
          {satellites.map((sat, i) => {
            const lineStart = 15 + i * lineStagger;
            const lineProgress = lerp(
              frame,
              [lineStart, lineStart + lineDrawDuration],
              [0, 1],
              Easing.out(Easing.cubic),
            );

            return (
              <ConnectionLine
                key={`radial-${i}`}
                x1={cx}
                y1={cy}
                x2={sat.x}
                y2={sat.y}
                progress={lineProgress}
                strokeWidth={s(1.5)}
                color={BLACKBOARD_COLORS.surfaceBorder}
              />
            );
          })}

          {/* Cross-connection lines: adjacent satellites */}
          {crossConnections.map(({ from, to }, i) => {
            const stagger = i * 2;
            const crossProgress = lerp(
              frame,
              [crossLineStart + stagger, crossLineStart + stagger + crossLineDuration],
              [0, 1],
              Easing.out(Easing.cubic),
            );

            return (
              <ConnectionLine
                key={`cross-${i}`}
                x1={satellites[from].x}
                y1={satellites[from].y}
                x2={satellites[to].x}
                y2={satellites[to].y}
                progress={crossProgress}
                strokeWidth={s(1)}
                color={BLACKBOARD_COLORS.surfaceBorder}
              />
            );
          })}

          {/* Pulse dots on radial connections */}
          {satellites.map((sat, i) => {
            // Only show dots after the line has fully drawn
            const lineEnd = 15 + i * lineStagger + lineDrawDuration;
            const dotStartFrame = Math.max(pulseStart, lineEnd);

            return (
              <React.Fragment key={`pulse-radial-${i}`}>
                {/* Outgoing dot: center → satellite (primary color) */}
                <PulseDot
                  x1={cx}
                  y1={cy}
                  x2={sat.x}
                  y2={sat.y}
                  frame={frame}
                  startFrame={dotStartFrame}
                  period={pulsePeriod}
                  phaseOffset={0}
                  radius={s(4)}
                  color={BLACKBOARD_COLORS.primary}
                />
                {/* Return dot: satellite → center (secondary color) */}
                <PulseDot
                  x1={sat.x}
                  y1={sat.y}
                  x2={cx}
                  y2={cy}
                  frame={frame}
                  startFrame={dotStartFrame}
                  period={pulsePeriod}
                  phaseOffset={Math.floor(pulsePeriod / 2)}
                  radius={s(3)}
                  color={BLACKBOARD_COLORS.secondary}
                />
              </React.Fragment>
            );
          })}

          {/* Pulse dots on cross-connections */}
          {crossConnections.map(({ from, to }, i) => {
            const crossEnd = crossLineStart + i * 2 + crossLineDuration;
            const dotStartFrame = Math.max(pulseStart, crossEnd);

            return (
              <React.Fragment key={`pulse-cross-${i}`}>
                <PulseDot
                  x1={satellites[from].x}
                  y1={satellites[from].y}
                  x2={satellites[to].x}
                  y2={satellites[to].y}
                  frame={frame}
                  startFrame={dotStartFrame}
                  period={pulsePeriod + 10}
                  phaseOffset={10}
                  radius={s(3)}
                  color={BLACKBOARD_COLORS.primary}
                />
              </React.Fragment>
            );
          })}
        </svg>

        {/* ── Center Node (div-based, absolutely positioned) ───────────── */}
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
              fontSize: s(13),
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

        {/* ── Satellite Nodes (div-based, absolutely positioned) ────────── */}
        {satellites.map((sat, i) => {
          const lineEnd = 15 + i * lineStagger + lineDrawDuration;
          const satScale = lerp(
            frame,
            [lineEnd - 5, lineEnd - 5 + satelliteScaleDuration],
            [0, 1],
            Easing.out(Easing.back(1.3)),
          );
          const satOpacity = lerp(frame, [lineEnd - 5, lineEnd], [0, 1]);

          return (
            <div
              key={`satellite-${i}`}
              style={{
                position: 'absolute',
                left: sat.x - satelliteNodeSize / 2,
                top: sat.y - satelliteNodeSize / 2,
                width: satelliteNodeSize,
                height: satelliteNodeSize,
                borderRadius: '50%',
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `${s(1)}px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: satOpacity,
                transform: `scale(${satScale})`,
              }}
            >
              {/* Label below the node */}
              <div
                style={{
                  position: 'absolute',
                  top: satelliteNodeSize + s(6),
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(16),
                  fontWeight: 500,
                  color: BLACKBOARD_COLORS.textMuted,
                  textAlign: 'center',
                }}
              >
                {nodes[i]}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerNetwork;
