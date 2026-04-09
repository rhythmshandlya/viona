import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxTimelineProps } from './schema';
import { VOX_COLORS, VOX_SIZES, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, popIn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxBody, VoxLabel } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxTimeline: React.FC<VoxTimelineProps> = ({ events, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  // Timeline line draws from top, starts at frame 20, takes 60 frames (inline interpolation)
  const lineProgress = interpolate(sf(frame), [20, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: voxEaseOut,
  });

  // Events stagger in after line starts drawing, default stagger (5 frames)
  const { itemOpacities } = progressiveBuild(frame, 25, events.length);

  const TIMELINE_LEFT = s(80);
  const DOT_SIZE = s(16);
  const CONTENT_LEFT = TIMELINE_LEFT + s(40);
  const TITLE_TOP = s(140);
  const EVENTS_TOP = TITLE_TOP + s(120);
  const EVENT_SPACING = s(200);
  const TOTAL_LINE_HEIGHT = EVENT_SPACING * (events.length - 1);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
    }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.3} seed={14} />

      {/* Title */}
      <div style={{
        position: 'absolute',
        top: s(80),
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
      }}>
        {title && (
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        )}
      </div>

      {/* SVG for vertical timeline line */}
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
        viewBox={`0 0 1080 1920`}
        preserveAspectRatio="none"
      >
        {/* Vertical line — drawn from top to bottom progressively */}
        <line
          x1={TIMELINE_LEFT}
          y1={EVENTS_TOP}
          x2={TIMELINE_LEFT}
          y2={EVENTS_TOP + TOTAL_LINE_HEIGHT * lineProgress}
          stroke={VOX_COLORS.lightGray}
          strokeWidth={s(3)}
          opacity={combinedOpacity}
        />
      </svg>

      {/* Event items */}
      {events.map((event, i) => {
        const isLast = i === events.length - 1;
        const dot = popIn(frame, 25 + i * 5);
        const eventTop = EVENTS_TOP + i * EVENT_SPACING;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: eventTop - s(16),
              left: 0,
              right: s(60),
              opacity: itemOpacities[i] * combinedOpacity,
            }}
          >
            {/* Dot marker */}
            <div style={{
              position: 'absolute',
              left: TIMELINE_LEFT - DOT_SIZE / 2,
              top: s(8),
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              backgroundColor: isLast ? VOX_COLORS.highlight : VOX_COLORS.teal,
              transform: `scale(${dot.scale})`,
              opacity: dot.opacity,
              zIndex: 2,
            }} />

            {/* Content */}
            <div style={{
              marginLeft: CONTENT_LEFT,
              display: 'flex',
              flexDirection: 'column',
              gap: s(6),
            }}>
              {/* Year */}
              <div style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.label),
                fontWeight: 700,
                color: isLast ? VOX_COLORS.charcoal : VOX_COLORS.teal,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.5,
                backgroundColor: isLast ? VOX_COLORS.highlight : 'transparent',
                display: 'inline-block',
                padding: isLast ? `${s(2)}px ${s(8)}px` : '0',
              }}>
                {event.year}
              </div>

              {/* Event label */}
              <div style={{
                fontFamily: 'Playfair Display',
                fontSize: s(VOX_SIZES.body),
                fontWeight: isLast ? 700 : 400,
                color: VOX_COLORS.charcoal,
                lineHeight: 1.4,
                maxWidth: s(800),
              }}>
                {event.label}
              </div>

              {/* Optional description */}
              {event.description && (
                <div style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.label),
                  color: VOX_COLORS.medGray,
                  lineHeight: 1.4,
                  maxWidth: s(800),
                }}>
                  {event.description}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxTimeline;
