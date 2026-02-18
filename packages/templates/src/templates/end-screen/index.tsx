import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { EndScreenProps } from './schema';

/* ------------------------------------------------------------------ */
/*  SVG sub-components                                                 */
/* ------------------------------------------------------------------ */

const DotGrid: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => {
  const dots: React.ReactNode[] = [];
  const spacing = 40;
  const cols = Math.ceil(1080 / spacing);
  const rows = Math.ceil(1080 / spacing);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing + spacing / 2}
          cy={r * spacing + spacing / 2}
          r={1.5}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={1080}
      height={1080}
      viewBox="0 0 1080 1080"
      style={{ position: 'absolute', top: 0, left: 0, opacity, pointerEvents: 'none' }}
    >
      {dots}
    </svg>
  );
};

const PlayTriangle: React.FC<{ color: string; size?: number }> = ({ color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M18 12L36 24L18 36V12Z" fill={color} opacity={0.7} />
  </svg>
);

const ChannelIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <circle cx={32} cy={32} r={30} stroke={color} strokeWidth={2.5} fill="none" />
    <circle cx={32} cy={26} r={10} stroke={color} strokeWidth={2} fill="none" />
    <path d="M14 54C14 44 22 38 32 38C42 38 50 44 50 54" stroke={color} strokeWidth={2} fill="none" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Video Placeholder                                                  */
/* ------------------------------------------------------------------ */

const VideoPlaceholder: React.FC<{
  label: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  headlineFont: string;
  bodyFont: string;
  playColor: string;
}> = ({ label, borderColor, textColor, mutedColor, headlineFont, bodyFont, playColor }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
    {/* Label */}
    <span
      style={{
        fontFamily: bodyFont,
        fontSize: 22,
        fontWeight: 600,
        color: mutedColor,
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>

    {/* Placeholder rectangle */}
    <div
      style={{
        width: 400,
        height: 260,
        borderRadius: 20,
        border: `3px dashed ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Inner subtle gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 17,
          background: `radial-gradient(ellipse at center, ${borderColor}10 0%, transparent 70%)`,
        }}
      />
      {/* Play icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      >
        <PlayTriangle color={playColor} size={36} />
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

const EndScreen: React.FC<EndScreenProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  /* ---- Animation values ---- */

  // Background fade in (0-15)
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Channel name fade in (15-35)
  const channelOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const channelSlideY = interpolate(frame, [15, 35], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Left video placeholder - spring slide from left (30-50)
  const leftSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const leftSlideX = interpolate(leftSpring, [0, 1], [-500, 0]);
  const leftOpacity = interpolate(leftSpring, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Right video placeholder - spring slide from right (40-60)
  const rightSpring = spring({
    frame: frame - 40,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const rightSlideX = interpolate(rightSpring, [0, 1], [500, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subscribe button - bounce scale in (55-75)
  const btnSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 10, stiffness: 160, mass: 0.7 },
  });
  const btnScale = interpolate(btnSpring, [0, 1], [0, 1]);
  const btnOpacity = interpolate(frame, [55, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subscribe button pulse (75-300)
  const pulsePhase = frame >= 75 && frame <= 300
    ? 1 + Math.sin((frame - 75) * 0.12) * 0.04
    : 1;
  const pulseGlow = frame >= 75 && frame <= 300
    ? 0.3 + Math.sin((frame - 75) * 0.12) * 0.15
    : 0;

  // Elements fade out (300-330)
  const contentFade = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Final fade out (330-360)
  const finalFade = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combine fades: content elements use contentFade * finalFade, bg uses finalFade
  const elementOpacity = contentFade;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: bgOpacity * finalFade }}>
      {/* Dot grid background */}
      <DotGrid
        color={props.background === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        opacity={elementOpacity}
      />

      {/* Channel name + icon at top */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          opacity: channelOpacity * elementOpacity,
          transform: `translateY(${channelSlideY}px)`,
        }}
      >
        <ChannelIcon color={props.accentColor} size={64} />
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: 42,
            fontWeight: 800,
            color: theme.text,
            letterSpacing: 3,
          }}
        >
          {props.channelName}
        </span>
        <div
          style={{
            width: 60,
            height: 3,
            backgroundColor: props.accentColor,
            borderRadius: 2,
            marginTop: 4,
          }}
        />
      </div>

      {/* Video placeholders row */}
      <div
        style={{
          position: 'absolute',
          top: 340,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 50,
        }}
      >
        {/* Left placeholder */}
        <div
          style={{
            opacity: leftOpacity * elementOpacity,
            transform: `translateX(${leftSlideX}px)`,
          }}
        >
          <VideoPlaceholder
            label={props.leftLabel}
            borderColor={props.accentColor}
            textColor={theme.text}
            mutedColor={theme.textMuted}
            headlineFont={FONTS.headline}
            bodyFont={FONTS.body}
            playColor={props.accentColor}
          />
        </div>

        {/* Right placeholder */}
        <div
          style={{
            opacity: rightOpacity * elementOpacity,
            transform: `translateX(${rightSlideX}px)`,
          }}
        >
          <VideoPlaceholder
            label={props.rightLabel}
            borderColor={props.accentColor}
            textColor={theme.text}
            mutedColor={theme.textMuted}
            headlineFont={FONTS.headline}
            bodyFont={FONTS.body}
            playColor={props.accentColor}
          />
        </div>
      </div>

      {/* Subscribe button */}
      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: btnOpacity * elementOpacity,
          transform: `scale(${btnScale * pulsePhase})`,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Glow behind button */}
          <div
            style={{
              position: 'absolute',
              width: 280,
              height: 70,
              borderRadius: 35,
              backgroundColor: props.accentColor,
              filter: 'blur(20px)',
              opacity: pulseGlow,
            }}
          />
          {/* Button */}
          <div
            style={{
              position: 'relative',
              width: 260,
              height: 60,
              borderRadius: 30,
              backgroundColor: props.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontFamily: FONTS.headline,
                fontSize: 24,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: 3,
              }}
            >
              {props.buttonText}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default EndScreen;
