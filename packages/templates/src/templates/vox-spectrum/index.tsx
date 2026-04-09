import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxSpectrumProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, drawOn, popIn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline } from '../../vox/typography';
import { RoughEdgeMask } from '../../vox/effects';
import { useScale } from '../../use-scale';

const VoxSpectrum: React.FC<VoxSpectrumProps> = ({ leftLabel, rightLabel, markers, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // Title + bar entrance
  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const barEntrance = voxEntrance(frame, 12, undefined, 'up', s(20));
  const titleOpacity = titleEntrance.opacity * exit.opacity;
  const barOpacity = barEntrance.opacity * exit.opacity;

  // Bar draws on
  const { progress: barProgress } = drawOn(frame, 15);

  // Markers pop in staggered after bar
  const MARKER_START = 30;
  const MARKER_STAGGER = 8;

  // Find the rightmost marker for highlight
  const maxPosition = Math.max(...markers.map((m) => m.position));

  const BAR_HEIGHT = s(16);
  const BAR_WIDTH_PERCENT = 85;
  const MARKER_DOT_SIZE = s(20);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={71} />

      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: s(60),
        right: s(60),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: s(80),
      }}>
        {/* Title */}
        {title && (
          <div style={{
            opacity: titleOpacity,
            transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
          }}>
            <VoxHeadline
              text={title}
              size={s(VOX_SIZES.h2)}
              color={VOX_COLORS.charcoal}
              accentBar="underline"
            />
          </div>
        )}

        {/* Spectrum bar section */}
        <div style={{
          opacity: barOpacity,
          transform: `translateY(${barEntrance.translateY + exit.translateY}px)`,
        }}>
          {/* Endpoint labels */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: s(32),
          }}>
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.label),
              fontWeight: 600,
              color: VOX_COLORS.darkGray,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              {leftLabel}
            </div>
            <div style={{
              fontFamily: VOX_FONTS.body,
              fontSize: s(VOX_SIZES.label),
              fontWeight: 600,
              color: VOX_COLORS.darkGray,
              textTransform: 'uppercase' as const,
              letterSpacing: 1,
            }}>
              {rightLabel}
            </div>
          </div>

          {/* Bar track */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: BAR_HEIGHT + s(120),
          }}>
            {/* The bar itself */}
            <RoughEdgeMask seed={42} scale={1.5}>
              <div style={{
                position: 'absolute',
                top: s(50),
                left: 0,
                width: `${barProgress * 100}%`,
                height: BAR_HEIGHT,
                backgroundColor: VOX_COLORS.charcoal,
                borderRadius: 2,
              }} />
            </RoughEdgeMask>

            {/* Gradient fill along bar */}
            <div style={{
              position: 'absolute',
              top: s(50),
              left: 0,
              width: `${barProgress * 100}%`,
              height: BAR_HEIGHT,
              background: `linear-gradient(to right, ${VOX_COLORS.lightGray}, ${VOX_COLORS.charcoal})`,
              borderRadius: 2,
              opacity: 0.6,
            }} />

            {/* Markers */}
            {markers.map((marker, i) => {
              const { scale: markerScale, opacity: markerOpacity } = popIn(frame, MARKER_START + i * MARKER_STAGGER, 8);
              const isHighlighted = marker.position === maxPosition;

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${marker.position}%`,
                    top: 0,
                    transform: `translateX(-50%) scale(${markerScale})`,
                    opacity: markerOpacity * exit.opacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: s(8),
                  }}
                >
                  {/* Marker dot */}
                  <div style={{
                    width: MARKER_DOT_SIZE,
                    height: MARKER_DOT_SIZE,
                    borderRadius: '50%',
                    backgroundColor: isHighlighted ? VOX_COLORS.highlight : VOX_COLORS.teal,
                    border: `3px solid ${isHighlighted ? VOX_COLORS.charcoal : VOX_COLORS.teal}`,
                    boxSizing: 'border-box' as const,
                  }} />
                  {/* Tick line to bar */}
                  <div style={{
                    width: 2,
                    height: s(20),
                    backgroundColor: isHighlighted ? VOX_COLORS.charcoal : VOX_COLORS.medGray,
                  }} />
                  {/* Label below bar */}
                  <div style={{
                    position: 'absolute',
                    top: s(90),
                    fontFamily: VOX_FONTS.body,
                    fontSize: s(VOX_SIZES.label),
                    fontWeight: isHighlighted ? 700 : 500,
                    color: isHighlighted ? VOX_COLORS.charcoal : VOX_COLORS.darkGray,
                    whiteSpace: 'nowrap' as const,
                    background: isHighlighted ? VOX_COLORS.highlight : 'transparent',
                    padding: isHighlighted ? `${s(2)}px ${s(8)}px` : 0,
                  }}>
                    {marker.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <FilmGrain opacity={0.28} seed={3} />
    </AbsoluteFill>
  );
};

export default VoxSpectrum;
