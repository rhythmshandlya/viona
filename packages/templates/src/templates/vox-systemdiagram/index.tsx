import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxSystemdiagramProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, popIn, voxIdle } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxSystemdiagram: React.FC<VoxSystemdiagramProps> = ({ actors, connections }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(15));
  const exitStart = durationInFrames - 10;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  // Nodes appear progressively
  const { itemOpacities } = progressiveBuild(frame, 15, actors.length);

  // Connection line draw-on
  const actorBuildEnd = 15 + actors.length * 5;
  const connectionProgress = connections.map((_, i) =>
    interpolate(sf(frame), [actorBuildEnd + i * 10, actorBuildEnd + i * 10 + 18], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: voxEaseOut,
    })
  );

  const connLabelOpacity = interpolate(frame, [actorBuildEnd + connections.length * 10, actorBuildEnd + connections.length * 10 + 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }) * combinedOpacity;

  // Responsive layout
  const PAD = s(50);
  const CX = W / 2;
  const CY = H * 0.48;
  const RADIUS = Math.min(W, H) * 0.28;
  const NODE_W = s(170);
  const NODE_H = s(90);

  // Position actors in a circle
  const actorPositions = actors.map((_, i) => {
    const angle = (i / actors.length) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: CX + RADIUS * Math.cos(angle),
      cy: CY + RADIUS * Math.sin(angle),
    };
  });

  // Arrowhead marker size
  const arrowSize = s(8);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.25} seed={8} />

      {/* Title */}
      <div style={{
        position: 'absolute', top: PAD, left: PAD, right: PAD,
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
      }}>
        <VoxHeadline text="System Overview" size={s(VOX_SIZES.h3)} color={VOX_COLORS.charcoal} accentBar="left" />
      </div>

      {/* SVG connections — viewBox = real canvas */}
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <marker id="vox-arrow" markerWidth={arrowSize} markerHeight={arrowSize}
            refX={arrowSize * 0.8} refY={arrowSize / 2} orient="auto">
            <polygon points={`0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}`}
              fill={VOX_COLORS.teal} opacity={0.7} />
          </marker>
        </defs>

        {connections.map((conn, i) => {
          const fromPos = actorPositions[conn.from];
          const toPos = actorPositions[conn.to];
          if (!fromPos || !toPos) return null;

          const progress = connectionProgress[i] ?? 0;
          // Shorten line endpoints so they don't overlap nodes
          const dx = toPos.cx - fromPos.cx;
          const dy = toPos.cy - fromPos.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / dist;
          const ny = dy / dist;
          const nodeInset = NODE_W * 0.45;
          const startX = fromPos.cx + nx * nodeInset;
          const startY = fromPos.cy + ny * nodeInset;
          const fullEndX = toPos.cx - nx * nodeInset;
          const fullEndY = toPos.cy - ny * nodeInset;
          const endX = startX + (fullEndX - startX) * progress;
          const endY = startY + (fullEndY - startY) * progress;

          // Curved path — offset midpoint perpendicular to line for arc
          const perpX = -ny * s(30);
          const perpY = nx * s(30);
          const ctrlX = (startX + endX) / 2 + perpX;
          const ctrlY = (startY + endY) / 2 + perpY;
          const midLabelX = (startX + endX) / 2 + perpX * 0.6;
          const midLabelY = (startY + endY) / 2 + perpY * 0.6;

          return (
            <g key={`conn-${i}`}>
              {/* Connection arc */}
              <path
                d={`M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
                fill="none"
                stroke={VOX_COLORS.teal}
                strokeWidth={s(2)}
                opacity={0.6 * combinedOpacity}
                markerEnd={progress > 0.9 ? 'url(#vox-arrow)' : undefined}
              />
              {/* Connection label */}
              {conn.label && progress > 0.8 && (
                <g opacity={connLabelOpacity}>
                  <rect
                    x={midLabelX - s(40)} y={midLabelY - s(12)}
                    width={s(80)} height={s(20)}
                    rx={s(3)}
                    fill={VOX_COLORS.offWhite} opacity={0.9}
                  />
                  <text x={midLabelX} y={midLabelY + s(3)}
                    textAnchor="middle" fontFamily={VOX_FONTS.mono}
                    fontSize={s(VOX_SIZES.tiny * 0.75)} fill={VOX_COLORS.teal}
                    fontWeight={600} letterSpacing={s(0.5)}>
                    {conn.label.toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Actor nodes (CSS positioned to match SVG coords) */}
      {actors.map((actor, i) => {
        const pos = actorPositions[i];
        if (!pos) return null;
        const nodeAnim = popIn(frame, 16 + i * 5);
        const idle = voxIdle(frame, i * 17 + 3);
        // Color accent — first actor gets highlight border
        const isFirst = i === 0;
        const borderColor = isFirst ? VOX_COLORS.highlight : VOX_COLORS.charcoal;

        return (
          <div key={`actor-${i}`} style={{
            position: 'absolute',
            left: pos.cx - NODE_W / 2,
            top: pos.cy - NODE_H / 2 + idle.translateY,
            width: NODE_W,
            height: NODE_H,
            opacity: itemOpacities[i] * nodeAnim.opacity * combinedOpacity,
            transform: `scale(${nodeAnim.scale})`,
            transformOrigin: 'center',
          }}>
            <RoughEdgeMask seed={i * 13 + 5} scale={2}>
              <div style={{
                width: NODE_W, height: NODE_H,
                backgroundColor: VOX_COLORS.offWhite,
                border: `${s(2.5)}px solid ${borderColor}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: `${s(8)}px ${s(10)}px`,
                boxSizing: 'border-box' as const,
              }}>
                <span style={{
                  fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny),
                  fontWeight: 700, color: VOX_COLORS.charcoal,
                  textTransform: 'uppercase' as const, letterSpacing: s(1),
                  textAlign: 'center',
                }}>
                  {actor.name}
                </span>
                <span style={{
                  fontFamily: VOX_FONTS.body, fontSize: s(VOX_SIZES.tiny * 0.8),
                  color: VOX_COLORS.medGray, marginTop: s(3), textAlign: 'center',
                }}>
                  {actor.role}
                </span>
              </div>
            </RoughEdgeMask>
          </div>
        );
      })}

      <FilmGrain opacity={0.2} />
    </AbsoluteFill>
  );
};

export default VoxSystemdiagram;
