import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { ProcessFlowProps } from './schema';

const ProcessFlow: React.FC<ProcessFlowProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];
  const steps = props.steps;
  const stepCount = steps.length;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleSlide = interpolate(frame, [0, 18], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const NODE_LEFT = 140;
  const CONTENT_LEFT = 220;
  const TOP_START = 140;
  const STEP_SPACING = (880 - TOP_START) / stepCount;
  const NODE_SIZE = 56;
  const stepsStart = 25;
  const framesPerStep = Math.floor((durationInFrames - 70 - stepsStart) / stepCount);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', opacity: titleOpacity, transform: `translateY(${titleSlide}px)` }}>
        <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 600, letterSpacing: 3, color: theme.textMuted, textTransform: 'uppercase' }}>{props.title}</span>
      </div>

      {steps.map((step, i) => {
        const y = TOP_START + i * STEP_SPACING;
        const enterFrame = stepsStart + i * framesPerStep;
        const localFrame = frame - enterFrame;
        const isLast = i === stepCount - 1;

        // Node circle
        const nodeScale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
        const nodeOpacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Content
        const contentOpacity = interpolate(localFrame, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const contentSlide = interpolate(localFrame, [8, 20], [25, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Connecting line to next node
        const lineProgress = !isLast ? interpolate(localFrame, [15, framesPerStep - 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;

        return (
          <React.Fragment key={i}>
            {/* Connecting line */}
            {!isLast && (
              <div style={{
                position: 'absolute',
                left: NODE_LEFT + NODE_SIZE / 2 - 1.5,
                top: y + NODE_SIZE + 4,
                width: 3,
                height: (STEP_SPACING - NODE_SIZE - 8) * lineProgress,
                backgroundColor: `${props.accentColor}40`,
                borderRadius: 2,
              }} />
            )}

            {/* Node circle */}
            <div style={{
              position: 'absolute',
              left: NODE_LEFT,
              top: y,
              width: NODE_SIZE,
              height: NODE_SIZE,
              borderRadius: '50%',
              backgroundColor: props.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: nodeOpacity,
              transform: `scale(${nodeScale})`,
              boxShadow: `0 0 16px ${props.accentColor}40`,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>
                {isLast ? '\u2713' : String(i + 1)}
              </span>
            </div>

            {/* Content */}
            <div style={{
              position: 'absolute',
              left: CONTENT_LEFT,
              top: y + 4,
              right: 60,
              opacity: contentOpacity,
              transform: `translateX(${contentSlide}px)`,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: 26, fontWeight: 700, color: theme.text }}>{step.title}</span>
              {step.description && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontFamily: FONTS.body, fontSize: 17, fontWeight: 400, color: theme.textMuted, lineHeight: 1.4 }}>{step.description}</span>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default ProcessFlow;
