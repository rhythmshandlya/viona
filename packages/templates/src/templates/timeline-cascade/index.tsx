import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { TimelineCascadeProps } from './schema';

const TimelineCascade: React.FC<TimelineCascadeProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];
  const milestones = props.milestones;
  const count = milestones.length;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleSlideY = interpolate(frame, [0, 20], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Timeline area
  const TIMELINE_TOP = 110;
  const TIMELINE_BOTTOM = 1000;
  const TIMELINE_HEIGHT = TIMELINE_BOTTOM - TIMELINE_TOP;
  const CENTER_X = 540;

  // Line draw progress (frames 15-290)
  const lineProgress = interpolate(frame, [15, 290], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const lineHeight = TIMELINE_HEIGHT * lineProgress;

  // Each milestone position
  const spacing = TIMELINE_HEIGHT / (count + 1);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 35, left: 0, right: 0, textAlign: 'center', opacity: titleOpacity, transform: `translateY(${titleSlideY}px)` }}>
        <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 600, letterSpacing: 3, color: theme.textMuted, textTransform: 'uppercase' }}>{props.title}</span>
      </div>

      {/* Background line track */}
      <div style={{ position: 'absolute', left: CENTER_X - 1, top: TIMELINE_TOP, width: 2, height: TIMELINE_HEIGHT, backgroundColor: theme.lineBg, borderRadius: 1 }} />

      {/* Animated line */}
      <div style={{ position: 'absolute', left: CENTER_X - 1.5, top: TIMELINE_TOP, width: 3, height: lineHeight, backgroundColor: props.accentColor, borderRadius: 2, boxShadow: `0 0 8px ${props.accentColor}40` }} />

      {/* Milestones */}
      {milestones.map((ms, i) => {
        const y = TIMELINE_TOP + spacing * (i + 1);
        const isLeft = i % 2 === 0;
        // Milestone appears when line reaches its position
        const milestoneFrac = (i + 1) / (count + 1);
        const lineReachesFrame = 15 + (290 - 15) * milestoneFrac;
        const localFrame = frame - lineReachesFrame;

        const dotScale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
        const dotOpacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        const cardOpacity = interpolate(localFrame, [5, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const cardSlideX = interpolate(localFrame, [5, 18], [isLeft ? -30 : 30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        return (
          <React.Fragment key={i}>
            {/* Dot */}
            <div style={{
              position: 'absolute',
              left: CENTER_X - 8,
              top: y - 8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: props.accentColor,
              border: `3px solid ${theme.bg}`,
              boxShadow: `0 0 0 2px ${props.accentColor}, 0 0 12px ${props.accentColor}50`,
              opacity: dotOpacity,
              transform: `scale(${dotScale})`,
            }} />

            {/* Connector line */}
            <div style={{
              position: 'absolute',
              top: y - 0.5,
              left: isLeft ? CENTER_X - 60 : CENTER_X + 16,
              width: 44,
              height: 1,
              backgroundColor: `${props.accentColor}50`,
              opacity: cardOpacity,
            }} />

            {/* Content card */}
            <div style={{
              position: 'absolute',
              top: y - 35,
              ...(isLeft ? { right: 1080 - CENTER_X + 64 } : { left: CENTER_X + 64 }),
              width: 380,
              opacity: cardOpacity,
              transform: `translateX(${cardSlideX}px)`,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: 16, fontWeight: 700, color: props.accentColor, letterSpacing: 2 }}>{ms.date}</span>
              <div style={{ marginTop: 4 }}>
                <span style={{ fontFamily: FONTS.headline, fontSize: 24, fontWeight: 800, color: theme.text }}>{ms.title}</span>
              </div>
              {ms.description && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontFamily: FONTS.body, fontSize: 16, fontWeight: 400, color: theme.textMuted, lineHeight: 1.4 }}>{ms.description}</span>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default TimelineCascade;
