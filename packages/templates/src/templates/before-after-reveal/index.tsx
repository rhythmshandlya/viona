import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { BeforeAfterRevealProps } from './schema';

const BeforeAfterReveal: React.FC<BeforeAfterRevealProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Title
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleSlideY = interpolate(frame, [0, 20], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Before side
  const beforeOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Divider sweep (top to bottom)
  const dividerProgress = interpolate(frame, [80, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const dividerGlow = interpolate(frame, [120, 150, 200, 230], [0, 1, 1, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // After side
  const afterOpacity = interpolate(frame, [100, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const HALF = 540;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center', opacity: titleOpacity, transform: `translateY(${titleSlideY}px)` }}>
        <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 600, letterSpacing: 3, color: theme.textMuted, textTransform: 'uppercase' }}>{props.title}</span>
      </div>

      {/* Before side (left) */}
      <div style={{ position: 'absolute', left: 0, top: 100, width: HALF, bottom: 60, opacity: beforeOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 40px' }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: 28, fontWeight: 800, color: props.beforeColor, letterSpacing: 4, marginBottom: 40 }}>{props.beforeLabel}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
          {props.beforeMetrics.map((m, i) => {
            const enterFrame = 25 + i * 12;
            const mOpacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const mSlide = interpolate(frame, [enterFrame, enterFrame + 15], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={i} style={{ opacity: mOpacity, transform: `translateY(${mSlide}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONTS.headline, fontSize: 52, fontWeight: 800, color: `${theme.text}90` }}>{m.value}</span>
                <span style={{ fontFamily: FONTS.body, fontSize: 18, fontWeight: 500, color: theme.textMuted }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* After side (right) */}
      <div style={{ position: 'absolute', right: 0, top: 100, width: HALF, bottom: 60, opacity: afterOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 40px' }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: 28, fontWeight: 800, color: props.afterColor, letterSpacing: 4, marginBottom: 40 }}>{props.afterLabel}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center' }}>
          {props.afterMetrics.map((m, i) => {
            const enterFrame = 115 + i * 12;
            const mOpacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const mSlide = interpolate(frame, [enterFrame, enterFrame + 15], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={i} style={{ opacity: mOpacity, transform: `translateY(${mSlide}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONTS.headline, fontSize: 52, fontWeight: 800, color: theme.text }}>{m.value}</span>
                <span style={{ fontFamily: FONTS.body, fontSize: 18, fontWeight: 500, color: theme.textMuted }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Animated divider */}
      <div style={{ position: 'absolute', left: HALF - 1.5, top: 100, width: 3, height: (1080 - 160) * dividerProgress, background: `${theme.text}30`, borderRadius: 2 }} />
      {/* Divider glow */}
      <div style={{ position: 'absolute', left: HALF - 20, top: 100, width: 40, height: (1080 - 160) * dividerProgress, background: `radial-gradient(ellipse at center, ${props.accentColor}${Math.round(dividerGlow * 40).toString(16).padStart(2, '0')} 0%, transparent 70%)`, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

export default BeforeAfterReveal;
