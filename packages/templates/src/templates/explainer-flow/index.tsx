import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerFlowProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const CLAMP = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

/** Fade + slight translateY entrance for a node card */
function nodeReveal(frame: number, start: number, duration = 20) {
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const translateY = interpolate(frame, [start, start + duration], [20, 0], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return { opacity, translateY };
}

/** Stroke-dashoffset based line draw animation */
function lineDraw(frame: number, start: number, duration: number, totalLength: number) {
  const progress = interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return totalLength * (1 - progress);
}

/* ── Traveling Dot ───────────────────────────────────────────────────────── */

interface TravelingDotProps {
  frame: number;
  /** Frame at which dots may start appearing on this connection */
  appearFrame: number;
  /** Y coordinate of the source node center */
  startY: number;
  /** Y coordinate of the destination node center */
  endY: number;
  /** Center X of the connection line */
  cx: number;
  /** Radius of the dot */
  r: number;
  /** Color of the dot */
  color: string;
  /** Dot index for stagger offset */
  dotIndex: number;
  /** Total number of dots on this connection */
  totalDots: number;
}

function TravelingDot({
  frame,
  appearFrame,
  startY,
  endY,
  cx,
  r,
  color,
  dotIndex,
  totalDots,
}: TravelingDotProps) {
  // Each dot loops through the connection independently
  const loopDuration = 40; // frames for one full trip
  const staggerOffset = Math.round((loopDuration / totalDots) * dotIndex);

  // Don't show until the connection's dots are meant to appear
  if (frame < appearFrame + staggerOffset) return null;

  const elapsed = frame - appearFrame - staggerOffset;
  const phase = elapsed % loopDuration;

  const y = interpolate(phase, [0, loopDuration], [startY, endY], CLAMP);

  // Fade in at the start and fade out at the end of each loop
  const fadeZone = 6;
  const fadeIn = interpolate(phase, [0, fadeZone], [0, 1], CLAMP);
  const fadeOut = interpolate(phase, [loopDuration - fadeZone, loopDuration], [1, 0], CLAMP);
  const opacity = fadeIn * fadeOut;

  return <circle cx={cx} cy={y} r={r} fill={color} opacity={opacity} />;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

const ExplainerFlow: React.FC<ExplainerFlowProps> = ({ showBackground, title, steps = [] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;

  // ── Layout constants ────────────────────────────────────────────────────
  const padX = s(isPortrait ? 80 : 120);
  const padTop = s(isPortrait ? 160 : 80);
  const padBottom = s(isPortrait ? 120 : 60);

  const nodeWidth = width - padX * 2;
  const nodeHeight = s(110);
  const nodeBorderRadius = s(12);
  const accentWidth = s(4);

  // Vertical spacing between node tops
  const connectionGap = s(60);
  const nodeStepHeight = nodeHeight + connectionGap;

  // Title area
  const titleHeight = s(80);
  const titleBottomMargin = s(48);

  // Where the first node starts (Y)
  const firstNodeY = padTop + titleHeight + titleBottomMargin;

  // Center X for the connection line
  const lineCenterX = width / 2;

  const dotsPerConnection = 4;
  const dotRadius = s(6);

  // ── Animation timeline ──────────────────────────────────────────────────
  // Title: 0-15
  const titleAnim = glowFadeIn(frame, 0, 15);

  // Exit: last 15 frames
  const exitStart = durationInFrames - 15;
  const exit = glowExit(frame, exitStart, 15);

  // Per-step timings
  const stepTimings = steps.map((_step, i) => {
    // Node reveal: staggered, starting at frame 10
    const nodeStart = 10 + i * 15;
    // Line draw starts slightly after the node appears
    const lineDrawStart = nodeStart + 10;
    const lineDrawDuration = 20;
    // Dots appear when the line is mostly drawn
    const dotsStart = lineDrawStart + 15;

    return { nodeStart, lineDrawStart, lineDrawDuration, dotsStart };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="flow-bg" />}

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: padTop,
            left: padX,
            right: padX,
            height: titleHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          <span
            style={{
              fontFamily: BLACKBOARD_FONTS.heading,
              fontSize: s(48),
              fontWeight: 700,
              color: BLACKBOARD_COLORS.text,
              letterSpacing: s(-0.5),
              textAlign: 'center',
            }}
          >
            {title}
          </span>
        </div>

        {/* ── SVG layer: connection lines + traveling dots ───────────── */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {steps.map((_step, i) => {
            if (i >= steps.length - 1) return null;

            const timing = stepTimings[i];
            const sourceNodeCenterY = firstNodeY + i * nodeStepHeight + nodeHeight;
            const destNodeCenterY = firstNodeY + (i + 1) * nodeStepHeight;
            const lineLength = destNodeCenterY - sourceNodeCenterY;

            // Dashed connection line
            const dashOffset = lineDraw(
              frame,
              timing.lineDrawStart,
              timing.lineDrawDuration,
              lineLength,
            );

            // Color alternates: odd connections = primary, even = secondary
            const connectionColor =
              i % 2 === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;

            return (
              <React.Fragment key={`conn-${i}`}>
                {/* Dashed line */}
                <line
                  x1={lineCenterX}
                  y1={sourceNodeCenterY}
                  x2={lineCenterX}
                  y2={destNodeCenterY}
                  stroke={BLACKBOARD_COLORS.surfaceBorder}
                  strokeWidth={s(2)}
                  strokeDasharray={`${s(8)} ${s(6)}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />

                {/* Traveling dots */}
                {Array.from({ length: dotsPerConnection }).map((_, dotIdx) => (
                  <TravelingDot
                    key={`dot-${i}-${dotIdx}`}
                    frame={frame}
                    appearFrame={timing.dotsStart}
                    startY={sourceNodeCenterY}
                    endY={destNodeCenterY}
                    cx={lineCenterX}
                    r={dotRadius}
                    color={connectionColor}
                    dotIndex={dotIdx}
                    totalDots={dotsPerConnection}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </svg>

        {/* ── Node cards ────────────────────────────────────────────────── */}
        {steps.map((step, i) => {
          const timing = stepTimings[i];
          const reveal = nodeReveal(frame, timing.nodeStart);
          const nodeY = firstNodeY + i * nodeStepHeight;

          const accentColor =
            i % 2 === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;

          return (
            <div
              key={`node-${i}`}
              style={{
                position: 'absolute',
                left: padX,
                top: nodeY,
                width: nodeWidth,
                height: nodeHeight,
                borderRadius: nodeBorderRadius,
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `${s(1)}px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                opacity: reveal.opacity,
                transform: `translateY(${reveal.translateY}px)`,
              }}
            >
              {/* Left accent strip */}
              <div
                style={{
                  width: accentWidth,
                  height: '100%',
                  backgroundColor: accentColor,
                  flexShrink: 0,
                }}
              />

              {/* Text content */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: `${s(16)}px ${s(24)}px`,
                  gap: s(6),
                }}
              >
                <div
                  style={{
                    fontFamily: BLACKBOARD_FONTS.heading,
                    fontSize: s(28),
                    fontWeight: 700,
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(20),
                      color: BLACKBOARD_COLORS.textMuted,
                      lineHeight: 1.3,
                    }}
                  >
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerFlow;
