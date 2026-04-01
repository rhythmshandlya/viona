import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerLayersProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

/* ── Arrow pulse helper ──────────────────────────────────────────────── */

function arrowPulseY(
  frame: number,
  loopStart: number,
  loopLength: number,
  amplitude: number,
): number {
  const t = Math.max(0, frame - loopStart);
  const phase = (t % loopLength) / loopLength; // 0-1 repeating
  // smooth sine oscillation: 0 → -amplitude → 0
  return -Math.sin(phase * Math.PI * 2) * amplitude * 0.5;
}

function arrowPulseOpacity(
  frame: number,
  loopStart: number,
  loopLength: number,
): number {
  const t = Math.max(0, frame - loopStart);
  const phase = (t % loopLength) / loopLength;
  // fade up then down within each cycle
  return 0.25 + Math.sin(phase * Math.PI) * 0.35;
}

/* ── Main component ──────────────────────────────────────────────────── */

const ExplainerLayers: React.FC<ExplainerLayersProps> = ({
  showBackground,
  title,
  layers = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;

  const isPortrait = height > width;

  // ── Dimensions ──────────────────────────────────────────────────────
  const layerW = s(800);
  const layerH = s(130);
  const layerGap = s(12);
  const layerRadius = s(12);
  const accentW = s(4);
  const badgeRadius = s(8);
  const badgePadH = s(14);
  const badgePadV = s(6);
  const badgeGap = s(8);
  const badgeFontSize = s(16);
  const labelFontSize = s(26);

  // Stack anchor: the bottommost layer's top-left Y coordinate
  const stackBottomY = s(1500);

  // ── Title animation (0-10) ──────────────────────────────────────────
  const titleAnim = glowFadeIn(frame, 0, 10);

  // ── Exit animation (135-150) ────────────────────────────────────────
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  // ── Layer slide-in ──────────────────────────────────────────────────
  // Bottom layer (index 0) enters first at frame 8, each subsequent
  // layer staggers by 8 frames.  Layers render bottom-to-top, so
  // index 0 is at the bottom of the visual stack.
  const layerCount = layers.length;

  // Compute the Y position for each layer (top-left corner).
  // Index 0 = bottom layer, index N-1 = top layer.
  const layerYPositions = layers.map((_l, i) => {
    const fromBottom = i; // 0 for bottom
    return stackBottomY - fromBottom * (layerH + layerGap);
  });

  // Center stack horizontally
  const stackLeftX = (width - layerW) / 2;

  /* ── Depth-mode: progressive width centered on speaker ──────────── */
  const depthLayerData = isDepthMode && depthData
    ? layers.map((_l, i) => {
        // Back layers (index 0) are narrower/dimmer, front layers (higher index) are wider/brighter
        const t = layerCount > 1 ? i / (layerCount - 1) : 1; // 0 (back) to 1 (front)
        const minW = s(400);
        const maxW = s(900);
        const w = minW + (maxW - minW) * t;
        const opacity = 0.4 + 0.6 * t;
        const centerX = depthData.centerPx.x;
        return { w, opacity, centerX, left: centerX - w / 2 };
      })
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="layers-bg" />}

        {/* ── Title ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: s(isPortrait ? 180 : 60),
            left: 0,
            width: '100%',
            textAlign: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}
        >
          <GlowHeading
            text={title ?? ''}
            size={s(52)}
            glowIntensity={titleAnim.glowProgress}
          />
        </div>

        {/* ── Layers ─────────────────────────────────────────────────── */}
        {layers.map((layer, i) => {
          const enterStart = 8 + i * 8;
          const enterDuration = 18;

          const slideY = interpolate(
            frame,
            [enterStart, enterStart + enterDuration],
            [s(100), 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.back(1.2)),
            },
          );

          const layerOpacity = interpolate(
            frame,
            [enterStart, enterStart + enterDuration * 0.5],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            },
          );

          const accentColor =
            i % 2 === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;

          // Sub-item badge fade-in
          const badgesStart = 55 + i * 4;
          const badgesOpacity = interpolate(
            frame,
            [badgesStart, badgesStart + 12],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            },
          );

          // Depth-mode adjustments: progressive width + dimming for back layers
          const depthLayer = depthLayerData ? depthLayerData[i] : null;
          const currentLayerW = depthLayer ? depthLayer.w : layerW;
          const currentLeftX = depthLayer ? depthLayer.left : stackLeftX;
          const depthOpacityMul = depthLayer ? depthLayer.opacity : 1;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: currentLeftX,
                top: layerYPositions[i],
                width: currentLayerW,
                height: layerH,
                opacity: layerOpacity * depthOpacityMul,
                transform: `translateY(${slideY}px)`,
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `1px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
                borderRadius: layerRadius,
                boxShadow: isDepthMode
                  ? `0 2px 12px rgba(0,0,0,${0.2 + 0.3 * (depthLayer ? 1 - depthLayer.opacity + 0.4 : 0)})`
                  : '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Left accent strip */}
              <div
                style={{
                  width: accentW,
                  height: '100%',
                  backgroundColor: accentColor,
                  flexShrink: 0,
                  borderRadius: `${layerRadius}px 0 0 ${layerRadius}px`,
                }}
              />

              {/* Content area */}
              <div
                style={{
                  flex: 1,
                  padding: `0 ${s(24)}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: s(8),
                }}
              >
                {/* Label */}
                <div
                  style={{
                    fontFamily: BLACKBOARD_FONTS.heading,
                    fontSize: labelFontSize,
                    fontWeight: 600,
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {layer.label}
                </div>

                {/* Sub-item badges */}
                {layer.items && layer.items.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: badgeGap,
                      opacity: badgesOpacity,
                    }}
                  >
                    {layer.items.map((item, j) => (
                      <div
                        key={j}
                        style={{
                          backgroundColor: BLACKBOARD_COLORS.surfaceBorder,
                          borderRadius: badgeRadius,
                          padding: `${badgePadV}px ${badgePadH}px`,
                          fontFamily: BLACKBOARD_FONTS.mono,
                          fontSize: badgeFontSize,
                          fontWeight: 500,
                          color: BLACKBOARD_COLORS.textMuted,
                          lineHeight: 1,
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Pulsing arrows between layers ──────────────────────────── */}
        {layers.map((_, i) => {
          if (i >= layerCount - 1) return null;

          // Arrow gap sits between layer i and layer i+1
          // Layer i (bottom-ish) top = layerYPositions[i]
          // Layer i+1 (above) bottom = layerYPositions[i+1] + layerH
          const gapTop = layerYPositions[i + 1] + layerH;
          const gapBottom = layerYPositions[i];
          const gapCenter = (gapTop + gapBottom) / 2;

          // 3 arrows per gap, spread horizontally
          const arrowW = s(10);
          const arrowH = s(8);
          const arrowSpread = s(80);
          const depthCenterX = depthData ? depthData.centerPx.x : stackLeftX + layerW / 2;
          const arrowCenterX = isDepthMode ? depthCenterX : stackLeftX + layerW / 2;
          const arrowXOffsets = [-arrowSpread, 0, arrowSpread];

          // Arrows become visible starting at frame 65, staggered by gap index
          const arrowsVisibleStart = 65 + i * 6;
          const arrowsVisible = interpolate(
            frame,
            [arrowsVisibleStart, arrowsVisibleStart + 10],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            },
          );

          if (arrowsVisible <= 0) return null;

          const loopLength = 30;
          const amplitude = s(8);

          return (
            <React.Fragment key={`arrows-${i}`}>
              {arrowXOffsets.map((xOff, ai) => {
                const arrowLoopStart = arrowsVisibleStart + ai * 10;
                const pY =
                  frame >= arrowLoopStart
                    ? arrowPulseY(frame, arrowLoopStart, loopLength, amplitude)
                    : 0;
                const pOpacity =
                  frame >= arrowLoopStart
                    ? arrowPulseOpacity(frame, arrowLoopStart, loopLength)
                    : 0;

                return (
                  <svg
                    key={ai}
                    width={arrowW}
                    height={arrowH}
                    viewBox={`0 0 ${arrowW} ${arrowH}`}
                    style={{
                      position: 'absolute',
                      left: arrowCenterX + xOff - arrowW / 2,
                      top: gapCenter - arrowH / 2,
                      transform: `translateY(${pY}px)`,
                      opacity: arrowsVisible * pOpacity,
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Upward-pointing triangle */}
                    <polygon
                      points={`${arrowW / 2},0 ${arrowW},${arrowH} 0,${arrowH}`}
                      fill={BLACKBOARD_COLORS.primary}
                      opacity={0.4}
                    />
                  </svg>
                );
              })}
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerLayers;
