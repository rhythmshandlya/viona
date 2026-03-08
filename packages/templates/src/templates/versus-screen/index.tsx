import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { VersusScreenProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                            */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="vs-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vs-dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Attribute row                                                      */
/* ------------------------------------------------------------------ */
const AttributeRow: React.FC<{
  text: string;
  frame: number;
  enterFrame: number;
  fps: number;
  color: string;
  font: string;
  side: 'left' | 'right';
  textColor: string;
}> = ({ text, frame, enterFrame, fps, color, font, side, textColor }) => {
  const s = useScale();
  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.8 },
  });

  const slideX = side === 'left' ? s(-60) * (1 - progress) : s(60) * (1 - progress);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: s(14),
        opacity: progress,
        transform: `translateX(${slideX}px)`,
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
      }}
    >
      <div
        style={{
          width: s(10),
          height: s(10),
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
          boxShadow: `0 0 ${s(8)}px ${color}`,
        }}
      />
      <span
        style={{
          fontFamily: font,
          fontSize: s(32),
          fontWeight: 500,
          color: textColor,
          letterSpacing: 0.5,
        }}
      >
        {text}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const VersusScreen: React.FC<VersusScreenProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  /* ---- global fade in / out ---- */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [330, 360],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  /* ---- left panel slide ---- */
  const leftSlide = spring({
    frame: frame - 15,
    fps,
    config: { damping: 20, stiffness: 90, mass: 1 },
  });
  const leftX = interpolate(leftSlide, [0, 1], [-540, 0]);

  /* ---- right panel slide ---- */
  const rightSlide = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 90, mass: 1 },
  });
  const rightX = interpolate(rightSlide, [0, 1], [540, 0]);

  /* ---- VS text slam (scale 3 -> 1 with heavy damping) ---- */
  const vsScale = spring({
    frame: frame - 35,
    fps,
    config: { damping: 10, stiffness: 200, mass: 1.4 },
  });
  const vsDisplayScale = interpolate(vsScale, [0, 1], [3, 1]);
  const vsOpacity = interpolate(frame, [35, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- divider flash / glow ---- */
  const dividerGlow = interpolate(
    frame,
    [50, 52, 55],
    [0, 1, 0.3],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const dividerBaseOpacity = interpolate(frame, [15, 25], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- panel slide out ---- */
  const exitProgress = interpolate(frame, [310, 340], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftExitX = -600 * exitProgress;
  const rightExitX = 600 * exitProgress;

  /* ---- attribute stagger timing ---- */
  const maxAttrs = Math.max(props.leftAttributes.length, props.rightAttributes.length);
  const attrSpacing = maxAttrs > 0 ? Math.min(20, Math.floor(145 / maxAttrs)) : 20;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * outroOpacity,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* ---- Left panel ---- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          transform: `translateX(${leftX + leftExitX}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${s(80)}px ${s(40)}px`,
          boxSizing: 'border-box',
        }}
      >
        {/* Left color wash overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${props.leftColor}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Left name */}
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(72),
            fontWeight: 800,
            color: props.leftColor,
            textTransform: 'uppercase',
            letterSpacing: s(4),
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: s(48),
            textShadow: `0 0 ${s(30)}px ${props.leftColor}66`,
            position: 'relative',
          }}
        >
          {props.leftName}
        </span>

        {/* Left attributes */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: s(20),
            alignItems: 'flex-start',
            width: '100%',
            paddingLeft: s(40),
            position: 'relative',
          }}
        >
          {props.leftAttributes.map((attr, i) => (
            <AttributeRow
              key={`left-${i}`}
              text={attr}
              frame={frame}
              enterFrame={55 + i * attrSpacing * 2}
              fps={fps}
              color={props.leftColor}
              font={FONTS.body}
              side="left"
              textColor={theme.text}
            />
          ))}
        </div>
      </div>

      {/* ---- Right panel ---- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100%',
          transform: `translateX(${rightX + rightExitX}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${s(80)}px ${s(40)}px`,
          boxSizing: 'border-box',
        }}
      >
        {/* Right color wash overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(225deg, ${props.rightColor}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Right name */}
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(72),
            fontWeight: 800,
            color: props.rightColor,
            textTransform: 'uppercase',
            letterSpacing: s(4),
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: s(48),
            textShadow: `0 0 ${s(30)}px ${props.rightColor}66`,
            position: 'relative',
          }}
        >
          {props.rightName}
        </span>

        {/* Right attributes */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: s(20),
            alignItems: 'flex-end',
            width: '100%',
            paddingRight: s(40),
            position: 'relative',
          }}
        >
          {props.rightAttributes.map((attr, i) => (
            <AttributeRow
              key={`right-${i}`}
              text={attr}
              frame={frame}
              enterFrame={55 + attrSpacing + i * attrSpacing * 2}
              fps={fps}
              color={props.rightColor}
              font={FONTS.body}
              side="right"
              textColor={theme.text}
            />
          ))}
        </div>
      </div>

      {/* ---- Center divider line ---- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          width: s(3),
          height: '100%',
          transform: 'translateX(-50%)',
          backgroundColor: theme.dividerGlow,
          opacity: dividerBaseOpacity + dividerGlow * 0.7,
          boxShadow: `0 0 ${s(12) + dividerGlow * s(30)}px ${dividerGlow * s(8)}px ${props.colors.accent}`,
          pointerEvents: 'none',
        }}
      />

      {/* ---- VS text ---- */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${vsDisplayScale})`,
          opacity: vsOpacity * (1 - exitProgress),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Glow layer behind VS */}
        <div
          style={{
            position: 'absolute',
            width: s(200),
            height: s(200),
            borderRadius: '50%',
            background: `radial-gradient(circle, ${props.colors.accent}44 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(140),
            fontWeight: 900,
            color: props.colors.accent,
            letterSpacing: s(8),
            textShadow: `
              0 0 ${s(20)}px ${props.colors.accent}88,
              0 0 ${s(60)}px ${props.colors.accent}44,
              0 0 ${s(100)}px ${props.colors.accent}22
            `,
            position: 'relative',
            lineHeight: 1,
          }}
        >
          VS
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default VersusScreen;
