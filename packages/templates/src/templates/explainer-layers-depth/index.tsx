import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerLayersDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { GlowHeading } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerLayersDepth: React.FC<ExplainerLayersDepthProps> = ({
  title,
  layers = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Title in top visible zone
  const titleAnim = glowFadeIn(frame, 0, 10);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const layerCount = layers.length;
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

  // Stack anchor: layers centered vertically around speaker center
  // Bottom layer (index 0) at bottom, top layer (index N-1) at top
  const stackBottomY = centerPx.y + ((layerCount - 1) * (layerH + layerGap)) / 2;

  // Layer widths grow from bottom (farther) to top (closer)
  // Bottom layers are narrower (behind speaker), top layers are wider (peek more)
  const minLayerW = s(700);
  const maxLayerW = s(900);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        <div style={{
          position: 'absolute',
          top: s(120),
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: titleAnim.contentProgress,
          transform: `scale(${titleAnim.scale})`,
        }}>
          <GlowHeading text={title ?? ''} size={s(52)} glowIntensity={titleAnim.glowProgress} />
        </div>

        {/* Layers — stacked behind speaker, widening toward viewer */}
        {layers.map((layer, i) => {
          const enterStart = 8 + i * 8;
          const enterDuration = 18;

          const slideY = interpolate(
            frame,
            [enterStart, enterStart + enterDuration],
            [s(100), 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2)) },
          );

          const layerOpacity = interpolate(
            frame,
            [enterStart, enterStart + enterDuration * 0.5],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Width grows from bottom to top (perspective depth)
          const widthProgress = layerCount > 1 ? i / (layerCount - 1) : 0.5;
          const layerW = minLayerW + (maxLayerW - minLayerW) * widthProgress;

          // Dimming: bottom layers dimmer, top layers brighter
          const brightnessMultiplier = 0.6 + widthProgress * 0.4;

          // Y position: bottom-up stacking centered on speaker
          const fromBottom = i;
          const layerY = stackBottomY - fromBottom * (layerH + layerGap);

          // Center horizontally on speaker
          const layerX = centerPx.x - layerW / 2;

          // Parallax: deeper layers drift less
          const depthTier = layerCount - 1 - i; // 0 = top/closest, N-1 = bottom/farthest
          const depthMul = Math.max(2, (depthTier + 1) * 4);
          const parallaxX = frame >= 60 ? Math.sin(frame * 0.02 + i * 1.5) * depthMul : 0;
          const parallaxY = frame >= 60 ? Math.sin(frame * 0.025 + i * 2.0) * depthMul * 0.6 : 0;

          const accentColor = i % 2 === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.secondary;

          // Sub-item badge fade-in
          const badgesStart = 55 + i * 4;
          const badgesOpacity = interpolate(
            frame,
            [badgesStart, badgesStart + 12],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: layerX + parallaxX,
                top: layerY + parallaxY,
                width: layerW,
                height: layerH,
                opacity: layerOpacity * brightnessMultiplier,
                transform: `translateY(${slideY}px)`,
                backgroundColor: BLACKBOARD_COLORS.surface,
                border: `1px solid ${BLACKBOARD_COLORS.surfaceBorder}`,
                borderRadius: layerRadius,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: i,
              }}
            >
              {/* Left accent strip */}
              <div style={{
                width: accentW,
                height: '100%',
                backgroundColor: accentColor,
                flexShrink: 0,
                borderRadius: `${layerRadius}px 0 0 ${layerRadius}px`,
              }} />

              {/* Content area */}
              <div style={{
                flex: 1,
                padding: `0 ${s(24)}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: s(8),
              }}>
                <div style={{
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: labelFontSize,
                  fontWeight: 600,
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}>
                  {layer.label}
                </div>

                {layer.items && layer.items.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: badgeGap,
                    opacity: badgesOpacity,
                  }}>
                    {layer.items.map((item, j) => (
                      <div key={j} style={{
                        backgroundColor: BLACKBOARD_COLORS.surfaceBorder,
                        borderRadius: badgeRadius,
                        padding: `${badgePadV}px ${badgePadH}px`,
                        fontFamily: BLACKBOARD_FONTS.mono,
                        fontSize: badgeFontSize,
                        fontWeight: 500,
                        color: BLACKBOARD_COLORS.textMuted,
                        lineHeight: 1,
                      }}>
                        {item}
                      </div>
                    ))}
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

export default ExplainerLayersDepth;
