import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerVennProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Calculate SVG arc path for the intersection of two circles */
function getIntersectionPath(
  cx1: number,
  cy: number,
  cx2: number,
  r: number,
): string {
  const d = cx2 - cx1;
  // No intersection
  if (d >= 2 * r) return '';
  // x-offset of intersection points from cx1
  const a = d / 2;
  // half-height of intersection lens
  const h = Math.sqrt(r * r - a * a);
  // Intersection points
  const ix = cx1 + a;
  const iy1 = cy - h;
  const iy2 = cy + h;

  // Draw lens using two arcs
  // Arc from top intersection to bottom via right circle, then back via left circle
  return [
    `M ${ix} ${iy1}`,
    `A ${r} ${r} 0 0 1 ${ix} ${iy2}`,
    `A ${r} ${r} 0 0 1 ${ix} ${iy1}`,
    'Z',
  ].join(' ');
}

/* ── Orbiting dots ──────────────────────────────────────────────────────── */

interface OrbitDot {
  angle0: number;
  orbitRadius: number;
  speed: number;
  size: number;
}

const LEFT_DOTS: OrbitDot[] = [
  { angle0: 0, orbitRadius: 0.55, speed: 0.035, size: 5 },
  { angle0: Math.PI * 0.7, orbitRadius: 0.45, speed: 0.028, size: 4 },
  { angle0: Math.PI * 1.3, orbitRadius: 0.6, speed: 0.042, size: 3 },
  { angle0: Math.PI * 0.4, orbitRadius: 0.35, speed: 0.032, size: 4 },
];

const RIGHT_DOTS: OrbitDot[] = [
  { angle0: Math.PI * 0.5, orbitRadius: 0.5, speed: 0.038, size: 5 },
  { angle0: Math.PI * 1.2, orbitRadius: 0.45, speed: 0.03, size: 4 },
  { angle0: Math.PI * 1.8, orbitRadius: 0.55, speed: 0.025, size: 3 },
  { angle0: Math.PI * 0.1, orbitRadius: 0.4, speed: 0.04, size: 4 },
];

/* ── Component ──────────────────────────────────────────────────────────── */

const ExplainerVenn: React.FC<ExplainerVennProps> = ({
  showBackground,
  title,
  leftLabel,
  rightLabel,
  leftItems = [],
  rightItems = [],
  sharedItems = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isPortrait = height > width;

  // ── Layout constants ───────────────────────────────────────────────────
  const circleR = s(280);
  const leftCx = s(350);
  const rightCx = s(730);
  const circleCy = isPortrait ? s(900) : s(540);
  const svgWidth = width;
  const svgHeight = height;

  // ── Title animation (0-10) ─────────────────────────────────────────────
  const titleAnim = glowFadeIn(frame, 0, 10);

  // ── Left circle slide in (5-30) ────────────────────────────────────────
  const leftSlideProgress = interpolate(frame, [5, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const leftTranslateX = interpolate(leftSlideProgress, [0, 1], [-s(200), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftCircleOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Right circle slide in (12-37) ──────────────────────────────────────
  const rightSlideProgress = interpolate(frame, [12, 37], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rightTranslateX = interpolate(rightSlideProgress, [0, 1], [s(200), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightCircleOpacity = interpolate(frame, [12, 27], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Label animations ──────────────────────────────────────────────────
  const leftLabelAnim = glowFadeIn(frame, 35, 15);
  const intersectionLabelAnim = glowFadeIn(frame, 42, 15);
  const rightLabelAnim = glowFadeIn(frame, 50, 15);

  // ── Description items fade in (60-80) ─────────────────────────────────
  const descStartFrame = 60;
  const descStagger = 5;

  // ── Intersection pulse (70-130) ────────────────────────────────────────
  const pulseActive = frame >= 70 && frame <= 130;
  let pulseOpacity = 0.2;
  if (pulseActive) {
    const pulseT = ((frame - 70) / 60) * Math.PI * 4; // ~2 full cycles over 60 frames
    pulseOpacity = 0.2 + Math.sin(pulseT) * 0.1; // oscillates 0.1 to 0.3
  }

  // ── Orbiting dots (80-125) ────────────────────────────────────────────
  const dotsOpacity = interpolate(frame, [80, 90, 120, 125], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit fade (135-150) ────────────────────────────────────────────────
  const exit = glowExit(frame, 135, 15);

  // ── Intersection path ─────────────────────────────────────────────────
  // Use current animated positions for intersection calculation
  const animLeftCx = leftCx + leftTranslateX;
  const animRightCx = rightCx + rightTranslateX;
  const intersectionPath = getIntersectionPath(animLeftCx, circleCy, animRightCx, circleR);

  // ── Render dots ────────────────────────────────────────────────────────
  function renderOrbitDots(
    dots: OrbitDot[],
    centerX: number,
    centerY: number,
    radius: number,
    color: string,
    offsetAngle: number,
  ) {
    return dots.map((dot, i) => {
      const angle = dot.angle0 + frame * dot.speed + offsetAngle;
      const orbitR = radius * dot.orbitRadius;
      const x = centerX + Math.cos(angle) * orbitR;
      const y = centerY + Math.sin(angle) * orbitR;
      return (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={s(dot.size)}
          fill={color}
          opacity={dotsOpacity}
        />
      );
    });
  }

  // ── Compute label positions ────────────────────────────────────────────
  // Left-only area center: halfway between left edge and start of overlap
  const leftOnlyCenterX = animLeftCx - circleR / 2.2;
  // Right-only area center: halfway between end of overlap and right edge
  const rightOnlyCenterX = animRightCx + circleR / 2.2;
  // Intersection center
  const intersectionCenterX = (animLeftCx + animRightCx) / 2;

  // ── Description area (below diagram) ──────────────────────────────────
  const descTopY = circleCy + circleR + s(60);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="venn-bg" />}

        {/* Title */}
        {title && (
          <div
            style={{
              position: 'absolute',
              top: isPortrait ? s(280) : s(80),
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
                fontSize: s(56),
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

        {/* SVG Venn Diagram */}
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Left circle */}
          <circle
            cx={animLeftCx}
            cy={circleCy}
            r={circleR}
            fill="rgba(249, 115, 22, 0.15)"
            stroke={BLACKBOARD_COLORS.primary}
            strokeWidth={s(1)}
            opacity={leftCircleOpacity}
          />

          {/* Right circle */}
          <circle
            cx={animRightCx}
            cy={circleCy}
            r={circleR}
            fill="rgba(59, 130, 246, 0.15)"
            stroke={BLACKBOARD_COLORS.secondary}
            strokeWidth={s(1)}
            opacity={rightCircleOpacity}
          />

          {/* Intersection highlight */}
          {intersectionPath && (
            <path
              d={intersectionPath}
              fill="rgba(200, 160, 100, 0.2)"
              opacity={Math.min(leftCircleOpacity, rightCircleOpacity) * (pulseOpacity / 0.2)}
            />
          )}

          {/* Orbiting dots — left circle exclusive area */}
          {frame >= 80 &&
            renderOrbitDots(
              LEFT_DOTS,
              animLeftCx - circleR * 0.2,
              circleCy,
              circleR * 0.6,
              BLACKBOARD_COLORS.primary,
              0,
            )}

          {/* Orbiting dots — right circle exclusive area */}
          {frame >= 80 &&
            renderOrbitDots(
              RIGHT_DOTS,
              animRightCx + circleR * 0.2,
              circleCy,
              circleR * 0.6,
              BLACKBOARD_COLORS.secondary,
              Math.PI,
            )}
        </svg>

        {/* Left area label */}
        <div
          style={{
            position: 'absolute',
            top: circleCy - s(20),
            left: leftOnlyCenterX - s(100),
            width: s(200),
            textAlign: 'center',
            opacity: leftLabelAnim.contentProgress,
            transform: `scale(${leftLabelAnim.scale})`,
          }}
        >
          <div
            style={{
              fontFamily: BLACKBOARD_FONTS.heading,
              fontSize: s(28),
              fontWeight: 600,
              color: BLACKBOARD_COLORS.primary,
              letterSpacing: '0.02em',
            }}
          >
            {leftLabel}
          </div>
          <div style={{ marginTop: s(12) }}>
            {leftItems.map((item, i) => {
              const itemAnim = glowFadeIn(frame, 35 + i * 4, 12);
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(20),
                    color: BLACKBOARD_COLORS.textMuted,
                    lineHeight: 1.8,
                    opacity: itemAnim.contentProgress,
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
        </div>

        {/* Intersection label */}
        <div
          style={{
            position: 'absolute',
            top: circleCy - s(20),
            left: intersectionCenterX - s(90),
            width: s(180),
            textAlign: 'center',
            opacity: intersectionLabelAnim.contentProgress,
            transform: `scale(${intersectionLabelAnim.scale})`,
          }}
        >
          <div
            style={{
              fontFamily: BLACKBOARD_FONTS.heading,
              fontSize: s(22),
              fontWeight: 600,
              color: BLACKBOARD_COLORS.text,
              letterSpacing: '0.02em',
              marginBottom: s(8),
            }}
          >
            Both
          </div>
          {sharedItems.map((item, i) => {
            const itemAnim = glowFadeIn(frame, 42 + i * 4, 12);
            return (
              <div
                key={i}
                style={{
                  fontFamily: BLACKBOARD_FONTS.body,
                  fontSize: s(18),
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.8,
                  opacity: itemAnim.contentProgress,
                }}
              >
                {item}
              </div>
            );
          })}
        </div>

        {/* Right area label */}
        <div
          style={{
            position: 'absolute',
            top: circleCy - s(20),
            left: rightOnlyCenterX - s(100),
            width: s(200),
            textAlign: 'center',
            opacity: rightLabelAnim.contentProgress,
            transform: `scale(${rightLabelAnim.scale})`,
          }}
        >
          <div
            style={{
              fontFamily: BLACKBOARD_FONTS.heading,
              fontSize: s(28),
              fontWeight: 600,
              color: BLACKBOARD_COLORS.secondary,
              letterSpacing: '0.02em',
            }}
          >
            {rightLabel}
          </div>
          <div style={{ marginTop: s(12) }}>
            {rightItems.map((item, i) => {
              const itemAnim = glowFadeIn(frame, 50 + i * 4, 12);
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(20),
                    color: BLACKBOARD_COLORS.textMuted,
                    lineHeight: 1.8,
                    opacity: itemAnim.contentProgress,
                  }}
                >
                  {item}
                </div>
              );
            })}
          </div>
        </div>

        {/* Description section below the diagram */}
        <div
          style={{
            position: 'absolute',
            top: descTopY,
            left: s(80),
            right: s(80),
          }}
        >
          {/* Left description */}
          {(() => {
            const anim = glowFadeIn(frame, descStartFrame, 15);
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: s(16),
                  marginBottom: s(20),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}
              >
                <div
                  style={{
                    width: s(10),
                    height: s(10),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.primary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.heading,
                      fontSize: s(24),
                      fontWeight: 600,
                      color: BLACKBOARD_COLORS.text,
                    }}
                  >
                    {leftLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(20),
                      color: BLACKBOARD_COLORS.textMuted,
                      marginTop: s(4),
                    }}
                  >
                    {leftItems.join(' \u00B7 ')}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Shared description */}
          {(() => {
            const anim = glowFadeIn(frame, descStartFrame + descStagger, 15);
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: s(16),
                  marginBottom: s(20),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}
              >
                <div
                  style={{
                    width: s(10),
                    height: s(10),
                    borderRadius: s(2),
                    backgroundColor: BLACKBOARD_COLORS.text,
                    marginTop: s(8),
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.heading,
                      fontSize: s(24),
                      fontWeight: 600,
                      color: BLACKBOARD_COLORS.text,
                    }}
                  >
                    Shared
                  </div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(20),
                      color: BLACKBOARD_COLORS.textMuted,
                      marginTop: s(4),
                    }}
                  >
                    {sharedItems.join(' \u00B7 ')}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Right description */}
          {(() => {
            const anim = glowFadeIn(frame, descStartFrame + descStagger * 2, 15);
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: s(16),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}
              >
                <div
                  style={{
                    width: s(10),
                    height: s(10),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.secondary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.heading,
                      fontSize: s(24),
                      fontWeight: 600,
                      color: BLACKBOARD_COLORS.text,
                    }}
                  >
                    {rightLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(20),
                      color: BLACKBOARD_COLORS.textMuted,
                      marginTop: s(4),
                    }}
                  >
                    {rightItems.join(' \u00B7 ')}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerVenn;
