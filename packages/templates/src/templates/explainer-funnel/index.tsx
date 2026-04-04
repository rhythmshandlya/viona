import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ExplainerFunnelProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';

// ── Particle configuration ──────────────────────────────────────────────────
const PARTICLE_COUNT = 10;
const LOOP_PERIOD = 50; // frames per particle cycle

interface ParticleState {
  spawnOffset: number;
  color: string;
  baseX: number; // 0-1 normalized horizontal position within funnel
}

function createParticles(s: (px: number) => number): ParticleState[] {
  const particles: ParticleState[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      spawnOffset: Math.floor((i * LOOP_PERIOD) / PARTICLE_COUNT),
      color: i % 3 === 0 ? BLACKBOARD_COLORS.secondary : BLACKBOARD_COLORS.primary,
      baseX: ((i * 7 + 3) % PARTICLE_COUNT) / PARTICLE_COUNT, // deterministic spread
    });
  }
  return particles;
}

function particleSurvivesStage(particleIndex: number, stageIndex: number): boolean {
  return (particleIndex * 7 + stageIndex * 3) % 5 !== 0;
}

// ── Funnel geometry helpers ─────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getFunnelWidthAtRatio(maxWidth: number, minWidth: number, ratio: number): number {
  return lerp(maxWidth, minWidth, ratio);
}

// ── Main component ──────────────────────────────────────────────────────────
const ExplainerFunnel: React.FC<ExplainerFunnelProps> = ({
  showBackground,
  title,
  stages = [],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const stageCount = stages.length;
  const maxWidth = s(800);
  const minWidth = s(300);
  const stageGap = s(4);
  const stageHeight = s(100);
  const totalFunnelHeight = stageCount * stageHeight + (stageCount - 1) * stageGap;

  // Funnel vertical positioning — centered in canvas with title above
  const titleAreaHeight = s(140);
  const funnelTopY = (height - totalFunnelHeight) / 2 + titleAreaHeight / 2;
  const centerX = width / 2;

  // ── Animation phases ────────────────────────────────────────────────────
  const titleAnim = glowFadeIn(frame, 0, 10);
  const exit = glowExit(frame, 135, 15);

  // ── Particles ───────────────────────────────────────────────────────────
  const particles = React.useMemo(() => createParticles(s), [s]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="funnel-bg" />}

        {/* ── Title ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: funnelTopY - titleAreaHeight,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          <GlowHeading
            text={title ?? 'Sales Funnel'}
            size={s(52)}
            glowIntensity={titleAnim.glowProgress}
          />
        </div>

        {/* ── Funnel SVG ─────────────────────────────────────────────── */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {stages.map((stage, i) => {
            const stageAnim = staggeredGlowIn(frame, 8, i, 8, 10);
            const topY = funnelTopY + i * (stageHeight + stageGap);
            const bottomY = topY + stageHeight;

            const topWidth = getFunnelWidthAtRatio(maxWidth, minWidth, i / stageCount);
            const bottomWidth = getFunnelWidthAtRatio(maxWidth, minWidth, (i + 1) / stageCount);

            const topLeft = centerX - topWidth / 2;
            const topRight = centerX + topWidth / 2;
            const bottomLeft = centerX - bottomWidth / 2;
            const bottomRight = centerX + bottomWidth / 2;

            // Slightly darker fill for deeper stages
            const fillOpacity = interpolate(i, [0, stageCount - 1], [0.6, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const scaleY = interpolate(stageAnim.contentProgress, [0, 1], [0.8, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const stageCenterY = (topY + bottomY) / 2;

            return (
              <g
                key={i}
                opacity={stageAnim.contentProgress}
                transform={`translate(0, ${stageCenterY * (1 - scaleY)}) scale(1, ${scaleY})`}
              >
                {/* Trapezoid shape */}
                <polygon
                  points={`${topLeft},${topY} ${topRight},${topY} ${bottomRight},${bottomY} ${bottomLeft},${bottomY}`}
                  fill={BLACKBOARD_COLORS.surface}
                  fillOpacity={fillOpacity}
                  stroke={BLACKBOARD_COLORS.surfaceBorder}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* ── Particles flowing through funnel ───────────────────── */}
          {frame >= 30 &&
            particles.map((particle, pIdx) => {
              const cycleFrame =
                ((frame - 30 - particle.spawnOffset) % LOOP_PERIOD + LOOP_PERIOD) % LOOP_PERIOD;

              // Particle travels from top to bottom of funnel over LOOP_PERIOD frames
              const travelProgress = interpolate(
                cycleFrame,
                [0, LOOP_PERIOD],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              // Y position along funnel
              const particleY = lerp(funnelTopY, funnelTopY + totalFunnelHeight, travelProgress);

              // Determine which stage the particle is in
              const stageFloat = travelProgress * stageCount;
              const currentStage = Math.min(Math.floor(stageFloat), stageCount - 1);

              // Check survival through each stage boundary
              let alive = true;
              let fadeMultiplier = 1;
              for (let si = 0; si < currentStage; si++) {
                if (!particleSurvivesStage(pIdx, si)) {
                  // Particle dies at this stage boundary
                  const deathRatio = (si + 1) / stageCount;
                  if (travelProgress > deathRatio) {
                    // Fade out around the boundary
                    const fadeZone = 0.08;
                    fadeMultiplier = interpolate(
                      travelProgress,
                      [deathRatio, deathRatio + fadeZone],
                      [1, 0],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    );
                    if (fadeMultiplier <= 0) alive = false;
                    break;
                  }
                }
              }

              if (!alive) return null;

              // X position narrows to match funnel width at current Y
              const funnelWidthAtY = getFunnelWidthAtRatio(maxWidth, minWidth, travelProgress);
              const spreadX = (particle.baseX - 0.5) * funnelWidthAtY * 0.7;
              const particleX = centerX + spreadX;

              // Overall particle visibility (only visible during particle phase, before exit)
              const particleOpacity = interpolate(
                frame,
                [30, 35, 130, 135],
                [0, 1, 1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              return (
                <circle
                  key={pIdx}
                  cx={particleX}
                  cy={particleY}
                  r={s(4)}
                  fill={particle.color}
                  opacity={particleOpacity * fadeMultiplier * 0.85}
                />
              );
            })}
        </svg>

        {/* ── Labels (left) and Values (right) ───────────────────────── */}
        {stages.map((stage, i) => {
          const stageAnim = staggeredGlowIn(frame, 8, i, 8, 10);
          const topY = funnelTopY + i * (stageHeight + stageGap);
          const stageCenterY = topY + stageHeight / 2;

          const topWidth = getFunnelWidthAtRatio(maxWidth, minWidth, i / stageCount);

          // Label on the left
          const labelX = centerX - topWidth / 2 - s(24);

          // Value animation: fade in staggered from frame 50
          const valueStart = 50 + i * 12;
          const valueOpacity = interpolate(
            frame,
            [valueStart, valueStart + 12],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const valueX = centerX + topWidth / 2 + s(24);

          return (
            <React.Fragment key={`labels-${i}`}>
              {/* Stage label — left aligned */}
              <div
                style={{
                  position: 'absolute',
                  right: width - labelX,
                  top: stageCenterY - s(12),
                  opacity: stageAnim.contentProgress,
                  transform: `scale(${interpolate(stageAnim.contentProgress, [0, 1], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: s(22),
                  fontWeight: 600,
                  color: BLACKBOARD_COLORS.text,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {stage.label}
              </div>

              {/* Stage value — right aligned */}
              <div
                style={{
                  position: 'absolute',
                  left: valueX,
                  top: stageCenterY - s(12),
                  opacity: valueOpacity,
                  fontFamily: BLACKBOARD_FONTS.mono,
                  fontSize: s(22),
                  fontWeight: 700,
                  color: BLACKBOARD_COLORS.primary,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {stage.value}
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerFunnel;
