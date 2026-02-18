import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { RatingDisplayProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                            */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern id="rating-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#rating-dot-grid)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Star SVG (filled / outline)                                       */
/* ------------------------------------------------------------------ */
const StarIcon: React.FC<{
  filled: boolean;
  size: number;
  filledColor: string;
  outlineColor: string;
  /** 0 = fully outline, 1 = fully filled (supports partial via clip) */
  fillProgress: number;
}> = ({ filled, size, filledColor, outlineColor, fillProgress }) => {
  const id = React.useId();

  const starPath =
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

  if (filled && fillProgress >= 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={starPath} fill={filledColor} />
      </svg>
    );
  }

  if (!filled || fillProgress <= 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d={starPath}
          fill="none"
          stroke={outlineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Partial fill via clipPath
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <clipPath id={`star-clip-${id}`}>
          <rect x="0" y="0" width={24 * fillProgress} height="24" />
        </clipPath>
      </defs>
      {/* Outline behind */}
      <path
        d={starPath}
        fill="none"
        stroke={outlineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Filled portion */}
      <path d={starPath} fill={filledColor} clipPath={`url(#star-clip-${id})`} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
const RatingDisplay: React.FC<RatingDisplayProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const STAR_COUNT = 5;
  const STAR_SIZE = 72;
  const STAR_GAP = 16;

  /* ---- Global fades ---- */
  // 0-15: Background fade in
  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // 310-340: Elements fade out
  const elementsFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Final fade out
  const finalFadeOut = interpolate(frame, [330, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Score counter: 20-60 ---- */
  const scoreProgress = interpolate(frame, [20, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const currentScore = scoreProgress * props.score;
  // Format: show one decimal place
  const displayScore = currentScore.toFixed(1);

  // Score scale-in entrance
  const scoreScale = interpolate(frame, [18, 35], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.4)),
  });

  const scoreOpacity = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /* ---- Stars fill: 40-90, stagger 10 frames per star ---- */
  const starFills = Array.from({ length: STAR_COUNT }, (_, i) => {
    const starStart = 40 + i * 10;
    const starEnd = starStart + 10;

    // Each star pops in with a scale bounce
    const fill = interpolate(frame, [starStart, starEnd], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });

    const scale = interpolate(frame, [starStart, starStart + 6, starEnd], [0.5, 1.2, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Determine if this star should be filled based on score
    const fullStars = Math.floor(props.score);
    const partialFraction = props.score - fullStars;

    let targetFill: number;
    if (i < fullStars) {
      targetFill = 1;
    } else if (i === fullStars) {
      targetFill = partialFraction;
    } else {
      targetFill = 0;
    }

    return { fill: fill * targetFill, scale };
  });

  /* ---- Label text: 80-100 ---- */
  const labelOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelSlideY = interpolate(frame, [80, 100], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  /* ---- Source name: 95-115 ---- */
  const sourceOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sourceSlideY = interpolate(frame, [95, 115], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  /* ---- Accent glow pulse ---- */
  const glowPulse = interpolate(
    frame % 90,
    [0, 45, 90],
    [0.8, 1.2, 0.8],
    { extrapolateRight: 'clamp' }
  );

  const glowScale = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const outlineColor =
    props.background === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * finalFadeOut,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Accent glow behind score */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 360,
          height: 360,
          marginTop: -260,
          marginLeft: -180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${props.accentColor}${props.background === 'dark' ? '55' : '30'} 0%, transparent 70%)`,
          opacity: theme.glowOpacity * glowPulse * glowScale * elementsFadeOut,
          transform: `scale(${glowPulse * glowScale})`,
          pointerEvents: 'none',
        }}
      />

      {/* Central content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          opacity: elementsFadeOut,
        }}
      >
        {/* Score number */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontSize: 160,
            fontWeight: 800,
            color: theme.text,
            lineHeight: 1,
            letterSpacing: -4,
            opacity: scoreOpacity,
            transform: `scale(${scoreScale})`,
          }}
        >
          {displayScore}
        </div>

        {/* "out of X" subtext */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 26,
            fontWeight: 400,
            color: theme.textMuted,
            opacity: scoreOpacity,
            marginTop: -12,
          }}
        >
          out of {props.maxScore}
        </div>

        {/* Star row */}
        {props.showStars && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: STAR_GAP,
              marginTop: 12,
            }}
          >
            {starFills.map((star, i) => (
              <div
                key={i}
                style={{
                  transform: `scale(${star.scale})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StarIcon
                  filled={star.fill > 0}
                  fillProgress={star.fill}
                  size={STAR_SIZE}
                  filledColor={props.accentColor}
                  outlineColor={outlineColor}
                />
              </div>
            ))}
          </div>
        )}

        {/* Review count label */}
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            fontWeight: 500,
            color: theme.textMuted,
            opacity: labelOpacity,
            transform: `translateY(${labelSlideY}px)`,
            marginTop: 20,
          }}
        >
          {props.reviewCount}
        </div>

        {/* Source / platform name */}
        {props.source && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 3,
              textTransform: 'uppercase' as const,
              color: props.accentColor,
              opacity: sourceOpacity,
              transform: `translateY(${sourceSlideY}px)`,
              marginTop: 4,
            }}
          >
            {props.source}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default RatingDisplay;
