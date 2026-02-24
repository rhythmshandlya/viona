import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { LogoStingerProps } from './schema';

const LogoStinger: React.FC<LogoStingerProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  if (props.style === 'minimal') {
    const nameOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const nameScale = interpolate(frame, [30, 60], [0.95, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const lineWidth = interpolate(frame, [70, 110], [0, s(120)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const tagOpacity = interpolate(frame, [100, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    return (
      <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: outroOpacity }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s(20) }}>
          <span style={{ fontFamily: FONTS.headline, fontSize: s(80), fontWeight: 800, color: theme.text, letterSpacing: s(12), opacity: nameOpacity, transform: `scale(${nameScale})` }}>{props.brandName}</span>
          <div style={{ width: lineWidth, height: s(2), backgroundColor: props.accentColor, borderRadius: s(1) }} />
          <span style={{ fontFamily: FONTS.body, fontSize: s(22), fontWeight: 400, color: theme.textMuted, letterSpacing: s(4), opacity: tagOpacity }}>{props.tagline}</span>
        </div>
      </AbsoluteFill>
    );
  }

  if (props.style === 'bold') {
    const flashOpacity = interpolate(frame, [55, 65, 75, 90], [0, 0.3, 0.3, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const nameScale = spring({ frame: frame - 60, fps, config: { damping: 10, stiffness: 150, mass: 0.8 } });
    const nameDisplayScale = interpolate(nameScale, [0, 1], [2.5, 1]);
    const nameOpacity = interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const tagOpacity = interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const tagSlide = interpolate(frame, [120, 150], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    return (
      <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: outroOpacity }}>
        {/* Flash */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: props.accentColor, opacity: flashOpacity }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s(24) }}>
          <span style={{ fontFamily: FONTS.headline, fontSize: s(100), fontWeight: 900, color: theme.text, letterSpacing: s(8), opacity: nameOpacity, transform: `scale(${nameDisplayScale})` }}>{props.brandName}</span>
          <span style={{ fontFamily: FONTS.body, fontSize: s(22), fontWeight: 400, color: theme.textMuted, letterSpacing: s(4), opacity: tagOpacity, transform: `translateY(${tagSlide}px)` }}>{props.tagline}</span>
        </div>
      </AbsoluteFill>
    );
  }

  // "geometric" style (default)
  // Shapes: 4 geometric elements converging to center
  const shapes = [
    { type: 'circle', startX: s(-200), startY: s(-200), startRot: -45 },
    { type: 'square', startX: s(1280), startY: s(-200), startRot: 45 },
    { type: 'circle', startX: s(1280), startY: s(1280), startRot: 135 },
    { type: 'diamond', startX: s(-200), startY: s(1280), startRot: -135 },
  ];

  const shapePositions = [
    { endX: s(260), endY: s(340) },
    { endX: s(820), endY: s(340) },
    { endX: s(820), endY: s(740) },
    { endX: s(260), endY: s(740) },
  ];

  const shapeProgress = interpolate(frame, [10, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  // Brand name
  const nameSpring = spring({ frame: frame - 90, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
  const nameScale = interpolate(nameSpring, [0, 1], [0, 1]);
  const nameOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Tagline
  const tagOpacity = interpolate(frame, [140, 170], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagSlide = interpolate(frame, [140, 170], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Accent line
  const lineWidth = interpolate(frame, [160, 200], [0, s(80)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Subtle float for shapes during hold
  const floatY = Math.sin(frame * 0.03) * 3;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: outroOpacity }}>
      {/* Geometric shapes */}
      {shapes.map((shape, i) => {
        const pos = shapePositions[i];
        const x = interpolate(shapeProgress, [0, 1], [shape.startX, pos.endX]);
        const y = interpolate(shapeProgress, [0, 1], [shape.startY, pos.endY]) + (shapeProgress >= 0.95 ? floatY : 0);
        const rot = interpolate(shapeProgress, [0, 1], [shape.startRot, 0]);
        const opacity = interpolate(shapeProgress, [0, 0.3], [0, 0.15]);
        const size = s(80);

        return (
          <div key={i} style={{
            position: 'absolute',
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            opacity,
            transform: `rotate(${rot + (shape.type === 'diamond' ? 45 : 0)}deg)`,
          }}>
            {shape.type === 'circle' ? (
              <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${i % 2 === 0 ? props.accentColor : props.secondaryColor}` }} />
            ) : (
              <div style={{ width: size, height: size, borderRadius: shape.type === 'diamond' ? s(4) : s(8), border: `2px solid ${i % 2 === 0 ? props.secondaryColor : props.accentColor}` }} />
            )}
          </div>
        );
      })}

      {/* Center content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s(16) }}>
        <span style={{
          fontFamily: FONTS.headline,
          fontSize: s(88),
          fontWeight: 900,
          color: theme.text,
          letterSpacing: s(10),
          opacity: nameOpacity,
          transform: `scale(${nameScale})`,
        }}>{props.brandName}</span>

        <div style={{ width: lineWidth, height: s(2), backgroundColor: props.accentColor, borderRadius: s(1) }} />

        <span style={{
          fontFamily: FONTS.body,
          fontSize: s(22),
          fontWeight: 400,
          color: theme.textMuted,
          letterSpacing: s(4),
          opacity: tagOpacity,
          transform: `translateY(${tagSlide}px)`,
        }}>{props.tagline}</span>
      </div>
    </AbsoluteFill>
  );
};

export default LogoStinger;
