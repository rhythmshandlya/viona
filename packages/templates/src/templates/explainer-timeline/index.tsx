import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ExplainerTimelineProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, drawLine, staggeredGlowIn } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { GlowCircle } from '../../blackboard/effects';
import { useScale } from '../../use-scale';

const ExplainerTimeline: React.FC<ExplainerTimelineProps> = ({ title, events }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const padX = s(40);
  const lineX = s(120);
  const circleSize = s(20);
  const eventCount = events.length;

  // Vertical layout: distribute events evenly within the timeline area
  const titleHeight = title ? s(80) : 0;
  const topMargin = s(120) + titleHeight;
  const bottomMargin = s(120);
  const availableHeight = height - topMargin - bottomMargin;
  const eventSpacing = eventCount > 1 ? availableHeight / (eventCount - 1) : 0;

  // Animations
  const titleAnim = glowFadeIn(frame, 5);
  const lineAnim = drawLine(frame, 15, 30);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  // SVG line coordinates
  const lineTop = topMargin;
  const lineBottom = topMargin + availableHeight;
  const lineLength = lineBottom - lineTop;
  const dashOffset = interpolate(lineAnim.progress, [0, 1], [lineLength, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="timeline-bg" />

        {/* Optional title */}
        {title && (
          <div
            style={{
              position: 'absolute',
              top: s(60),
              left: padX,
              right: padX,
              textAlign: 'center',
              opacity: titleAnim.contentProgress,
              transform: `scale(${titleAnim.scale})`,
            }}
          >
            <GlowHeading text={title} size={s(44)} glowIntensity={titleAnim.glowProgress} />
          </div>
        )}

        {/* Vertical glowing line (SVG) */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <filter id="line-glow">
              <feDropShadow dx={0} dy={0} stdDeviation={4} floodColor={BLACKBOARD_COLORS.primary} floodOpacity={0.6} />
              <feDropShadow dx={0} dy={0} stdDeviation={10} floodColor={BLACKBOARD_COLORS.primary} floodOpacity={0.2} />
            </filter>
          </defs>
          <line
            x1={lineX}
            y1={lineTop}
            x2={lineX}
            y2={lineBottom}
            stroke={BLACKBOARD_COLORS.primary}
            strokeWidth={s(2)}
            strokeDasharray={lineLength}
            strokeDashoffset={dashOffset}
            filter="url(#line-glow)"
          />
        </svg>

        {/* Event nodes */}
        {events.map((event, index) => {
          const eventY = topMargin + index * eventSpacing;
          const nodeAnim = staggeredGlowIn(frame, 25, index, 10);

          return (
            <div key={index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {/* Cyan glow circle on the line */}
              <div
                style={{
                  position: 'absolute',
                  left: lineX - circleSize / 2,
                  top: eventY - circleSize / 2,
                  opacity: nodeAnim.contentProgress,
                  transform: `scale(${nodeAnim.scale})`,
                }}
              >
                <GlowCircle size={circleSize} glowColor="secondary" glowIntensity={nodeAnim.glowProgress} />
              </div>

              {/* Date label — left of the line */}
              <div
                style={{
                  position: 'absolute',
                  right: width - lineX + s(20),
                  top: eventY - s(12),
                  opacity: nodeAnim.contentProgress,
                  transform: `scale(${nodeAnim.scale})`,
                  textAlign: 'right',
                }}
              >
                <div
                  style={{
                    fontFamily: BLACKBOARD_FONTS.mono,
                    fontSize: s(22),
                    fontWeight: 700,
                    color: BLACKBOARD_COLORS.primary,
                    textShadow: nodeAnim.glowProgress > 0
                      ? `0 0 20px rgba(245,158,11,${(nodeAnim.glowProgress * 0.3).toFixed(2)})`
                      : 'none',
                  }}
                >
                  {event.date}
                </div>
              </div>

              {/* Label and detail — right of the line */}
              <div
                style={{
                  position: 'absolute',
                  left: lineX + circleSize / 2 + s(20),
                  right: padX,
                  top: eventY - s(16),
                  opacity: nodeAnim.contentProgress,
                  transform: `scale(${nodeAnim.scale})`,
                }}
              >
                <div
                  style={{
                    fontFamily: BLACKBOARD_FONTS.heading,
                    fontSize: s(26),
                    fontWeight: 700,
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.2,
                  }}
                >
                  {event.label}
                </div>
                {event.detail && (
                  <div
                    style={{
                      fontFamily: BLACKBOARD_FONTS.body,
                      fontSize: s(20),
                      color: BLACKBOARD_COLORS.textMuted,
                      marginTop: s(6),
                      lineHeight: 1.3,
                    }}
                  >
                    {event.detail}
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

export default ExplainerTimeline;
