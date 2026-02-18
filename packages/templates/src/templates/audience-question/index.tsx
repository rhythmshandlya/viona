import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { AudienceQuestionProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                             */
/* ------------------------------------------------------------------ */

const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="aq-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#aq-dot-grid)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Decorative thought-bubble circles                                  */
/* ------------------------------------------------------------------ */

const ThoughtBubbles: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
    {/* Bottom-left trailing bubbles */}
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 120,
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 220,
        left: 170,
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 270,
        left: 140,
        width: 46,
        height: 46,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
    {/* Top-right trailing bubbles */}
    <div
      style={{
        position: 'absolute',
        top: 180,
        right: 120,
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 220,
        right: 170,
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 270,
        right: 140,
        width: 46,
        height: 46,
        borderRadius: '50%',
        border: `2px solid ${color}`,
      }}
    />
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const AudienceQuestion: React.FC<AudienceQuestionProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  /* ---- Background fade in (0-15) ---- */
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Large question mark scale in (15-40) ---- */
  const qMarkSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 16, stiffness: 80, mass: 1.0 },
  });
  const qMarkScale = frame < 15 ? 0 : qMarkSpring;

  /* ---- Question text spring in (30-60) ---- */
  const questionSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const questionScale = frame < 30 ? 0 : questionSpring;

  /* ---- CTA text fade in + slide up (55-80) ---- */
  const ctaFadeIn = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaSlideUp = interpolate(frame, [55, 80], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Thought bubbles fade in alongside question mark ---- */
  const bubblesOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Exit: elements fade/scale out (310-340) ---- */
  const elementsOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Final fade out (330-360) ---- */
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Subtle floating animation during hold (80-310) ---- */
  let floatY = 0;
  if (frame >= 80 && frame <= 310) {
    const t = (frame - 80) / 230;
    floatY = Math.sin(t * Math.PI * 4) * 6;
  }

  /* ---- Accent color glow pulse during hold ---- */
  let glowIntensity = 0;
  if (frame >= 80 && frame <= 310) {
    const t = (frame - 80) / 230;
    glowIntensity = 0.3 + Math.sin(t * Math.PI * 6) * 0.15;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * fadeOut,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid background */}
      <DotGrid color={theme.gridColor} />

      {/* Large question mark decoration - background layer at 15% opacity */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: 700,
            fontWeight: 900,
            color: theme.questionMark,
            lineHeight: 1,
            transform: `scale(${qMarkScale * elementsOut})`,
            userSelect: 'none',
          }}
        >
          ?
        </span>
      </div>

      {/* Decorative thought bubbles */}
      <ThoughtBubbles
        color={`${props.accentColor}40`}
        opacity={bubblesOpacity * elementsOut}
      />

      {/* Content container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          transform: `translateY(${floatY}px)`,
        }}
      >
        {/* Question text */}
        <div
          style={{
            transform: `scale(${questionScale * elementsOut})`,
            transformOrigin: 'center',
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          <h1
            style={{
              fontFamily: FONTS.headline,
              fontSize: 72,
              fontWeight: 900,
              color: theme.text,
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: -1,
              textShadow: glowIntensity > 0
                ? `0 0 40px ${props.accentColor}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}`
                : 'none',
            }}
          >
            {props.question}
          </h1>

          {/* Accent underline */}
          <div
            style={{
              width: 120,
              height: 4,
              backgroundColor: props.accentColor,
              borderRadius: 2,
              margin: '28px auto 0',
              boxShadow: `0 0 20px ${props.accentColor}66`,
            }}
          />
        </div>

        {/* CTA text */}
        <div
          style={{
            opacity: ctaFadeIn * elementsOut,
            transform: `translateY(${ctaSlideUp}px)`,
            marginTop: 48,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: 28,
              fontWeight: 500,
              color: theme.textMuted,
              margin: 0,
              letterSpacing: 0.5,
            }}
          >
            {props.cta}
          </p>
        </div>
      </div>

      {/* Decorative corner accents */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          width: 60,
          height: 60,
          borderTop: `3px solid ${props.accentColor}44`,
          borderLeft: `3px solid ${props.accentColor}44`,
          borderTopLeftRadius: 8,
          opacity: bubblesOpacity * elementsOut,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          width: 60,
          height: 60,
          borderTop: `3px solid ${props.accentColor}44`,
          borderRight: `3px solid ${props.accentColor}44`,
          borderTopRightRadius: 8,
          opacity: bubblesOpacity * elementsOut,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          width: 60,
          height: 60,
          borderBottom: `3px solid ${props.accentColor}44`,
          borderLeft: `3px solid ${props.accentColor}44`,
          borderBottomLeftRadius: 8,
          opacity: bubblesOpacity * elementsOut,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: 60,
          height: 60,
          borderBottom: `3px solid ${props.accentColor}44`,
          borderRight: `3px solid ${props.accentColor}44`,
          borderBottomRightRadius: 8,
          opacity: bubblesOpacity * elementsOut,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default AudienceQuestion;
