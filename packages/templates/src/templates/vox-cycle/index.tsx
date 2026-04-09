import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxCycleProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, popIn, voxIdle } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxCycle: React.FC<VoxCycleProps> = ({ steps, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(15));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const idle = voxIdle(frame, 21);

  const { itemOpacities } = progressiveBuild(frame, 20, steps.length);

  // Responsive layout — circle adapts to any aspect ratio
  const PAD = s(50);
  const TITLE_H = title ? s(110) : s(20);
  const AVAILABLE_W = W - PAD * 2;
  const AVAILABLE_H = H - PAD - TITLE_H - s(40);

  // Circle fits within available space
  const CX = W / 2;
  const CY = TITLE_H + PAD + AVAILABLE_H / 2;
  const RADIUS = Math.min(AVAILABLE_W, AVAILABLE_H) * 0.32;

  // Node sizing — responsive
  const NODE_W = s(140);
  const NODE_H = s(52);
  const ARROW_RADIUS = RADIUS + s(6); // Arcs drawn slightly outside the node circle

  const n = steps.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Top

  const positions = steps.map((_, i) => {
    const angle = startAngle + i * angleStep;
    return {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
      angle,
    };
  });

  // Arc draw-on progress for each connector
  const arcProgresses = steps.map((_, i) =>
    interpolate(sf(frame), [25 + i * 6, 40 + i * 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    })
  );

  // SVG arc between consecutive step positions (outside the circle, as curved arrows)
  function arcBetween(fromAngle: number, toAngle: number, progress: number): string {
    // Offset slightly inward from node edge to avoid overlap
    const gap = angleStep * 0.15; // gap at each end so arc doesn't touch node center
    const arcStart = fromAngle + gap;
    const arcEnd = fromAngle + (toAngle - fromAngle) * progress - (progress > 0.8 ? gap * progress : 0);

    const x1 = CX + ARROW_RADIUS * Math.cos(arcStart);
    const y1 = CY + ARROW_RADIUS * Math.sin(arcStart);
    const x2 = CX + ARROW_RADIUS * Math.cos(arcEnd);
    const y2 = CY + ARROW_RADIUS * Math.sin(arcEnd);

    // Use large arc flag if spanning more than 180°
    const angleDiff = arcEnd - arcStart;
    const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;

    return `M ${x1} ${y1} A ${ARROW_RADIUS} ${ARROW_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Arrowhead at arc endpoint
  function arrowHead(fromAngle: number, toAngle: number, progress: number): { x: number; y: number; rot: number } | null {
    if (progress < 0.3) return null;
    const gap = angleStep * 0.15;
    const arcEnd = fromAngle + (toAngle - fromAngle) * progress - (progress > 0.8 ? gap * progress : 0);
    const x = CX + ARROW_RADIUS * Math.cos(arcEnd);
    const y = CY + ARROW_RADIUS * Math.sin(arcEnd);
    // Tangent direction (perpendicular to radius at that point = arcEnd + 90°)
    const rot = (arcEnd + Math.PI / 2) * (180 / Math.PI);
    return { x, y, rot };
  }

  const arrowSize = s(7);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.25} seed={21} />

      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute',
          top: PAD,
          left: PAD,
          right: PAD,
          opacity: combinedOpacity,
          transform: `translateY(${entrance.translateY + exit.translateY + idle.translateY}px)`,
        }}>
          <VoxHeadline text={title} size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
        </div>
      )}

      {/* SVG arcs + arrowheads — viewBox = actual canvas */}
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <marker id="vox-cycle-arrow" markerWidth={arrowSize} markerHeight={arrowSize}
            refX={arrowSize * 0.5} refY={arrowSize / 2} orient="auto">
            <polygon points={`0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}`}
              fill={VOX_COLORS.teal} opacity={0.8} />
          </marker>
        </defs>

        {/* Faint circle guide */}
        <circle cx={CX} cy={CY} r={RADIUS}
          fill="none" stroke={VOX_COLORS.lightGray} strokeWidth={s(1)}
          strokeDasharray={`${s(4)} ${s(8)}`} opacity={0.2 * combinedOpacity} />

        {/* Arc connectors */}
        {steps.map((_, i) => {
          const fromAngle = positions[i].angle;
          const toAngle = fromAngle + angleStep;
          const progress = arcProgresses[i];
          const d = arcBetween(fromAngle, toAngle, progress);

          return (
            <path
              key={`arc-${i}`}
              d={d}
              fill="none"
              stroke={VOX_COLORS.teal}
              strokeWidth={s(2.5)}
              strokeLinecap="round"
              opacity={combinedOpacity * itemOpacities[i] * 0.7}
              markerEnd={progress > 0.85 ? 'url(#vox-cycle-arrow)' : undefined}
            />
          );
        })}
      </svg>

      {/* Step nodes */}
      {steps.map((step, i) => {
        const pos = positions[i];
        const isActive = i === 0; // First step highlighted (the "start" of the cycle)
        const nodeAnim = popIn(frame, 20 + i * 6);
        const nodeIdle = voxIdle(frame, i * 13 + 7);

        return (
          <div key={`node-${i}`} style={{
            position: 'absolute',
            left: pos.x - NODE_W / 2,
            top: pos.y - NODE_H / 2 + nodeIdle.translateY,
            width: NODE_W,
            height: NODE_H,
            opacity: itemOpacities[i] * nodeAnim.opacity * combinedOpacity,
            transform: `scale(${nodeAnim.scale})`,
            transformOrigin: 'center',
          }}>
            <RoughEdgeMask seed={i * 11 + 7}>
              <div style={{
                width: NODE_W,
                height: NODE_H,
                backgroundColor: isActive ? VOX_COLORS.highlight : VOX_COLORS.offWhite,
                border: `${s(2)}px solid ${isActive ? VOX_COLORS.charcoal : VOX_COLORS.charcoal}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                padding: `0 ${s(8)}px`,
              }}>
                <span style={{
                  fontFamily: VOX_FONTS.body,
                  fontSize: s(VOX_SIZES.tiny),
                  fontWeight: 700,
                  color: VOX_COLORS.charcoal,
                  textTransform: 'uppercase' as const,
                  letterSpacing: s(1),
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {step}
                </span>
              </div>
            </RoughEdgeMask>
            {/* Step number badge */}
            <div style={{
              position: 'absolute',
              top: -s(10),
              left: -s(10),
              width: s(24),
              height: s(24),
              borderRadius: '50%',
              backgroundColor: isActive ? VOX_COLORS.charcoal : VOX_COLORS.teal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: VOX_FONTS.mono,
                fontSize: s(11),
                fontWeight: 700,
                color: VOX_COLORS.offWhite,
              }}>
                {i + 1}
              </span>
            </div>
          </div>
        );
      })}

      {/* Center label */}
      <div style={{
        position: 'absolute',
        left: CX - s(60),
        top: CY - s(16),
        width: s(120),
        textAlign: 'center',
        opacity: combinedOpacity * 0.3,
      }}>
        <span style={{
          fontFamily: VOX_FONTS.mono,
          fontSize: s(VOX_SIZES.tiny * 0.7),
          color: VOX_COLORS.medGray,
          textTransform: 'uppercase' as const,
          letterSpacing: s(2),
        }}>
          CYCLE
        </span>
      </div>

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxCycle;
