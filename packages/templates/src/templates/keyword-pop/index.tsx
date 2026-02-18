import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { KeywordPopProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <defs>
      <pattern
        id="kp-dot-grid"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="16" cy="16" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#kp-dot-grid)" />
  </svg>
);

const KeywordPop: React.FC<KeywordPopProps> = (props) => {
  const { FONTS, SPRING_CONFIG } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const keywords = props.keywords;
  const keywordCount = keywords.length;

  // --- Timeline ---
  // 0-15: Background fade in
  // 15-310: Keywords cycle (evenly split)
  // 310-330: Last keyword holds
  // 330-360: Fade out

  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const outroOpacity = interpolate(
    frame,
    [330, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Per-keyword timing within the 15-310 range
  const keywordsStart = 15;
  const keywordsEnd = 310;
  const totalKeywordFrames = keywordsEnd - keywordsStart; // 295 frames
  const perKeywordDuration = Math.floor(totalKeywordFrames / keywordCount);

  // Determine which keyword is currently active
  const getActiveKeywordIndex = (f: number): number => {
    if (f < keywordsStart) return 0;
    if (f >= keywordsEnd) return keywordCount - 1;
    const elapsed = f - keywordsStart;
    const idx = Math.min(
      Math.floor(elapsed / perKeywordDuration),
      keywordCount - 1
    );
    return idx;
  };

  const activeIndex = getActiveKeywordIndex(frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * outroOpacity,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid SVG background */}
      <DotGrid color={theme.gridColor} />

      {/* Keywords */}
      {keywords.map((keyword, i) => {
        const kwStart = keywordsStart + i * perKeywordDuration;
        const kwEnd =
          i === keywordCount - 1
            ? 330 // Last keyword holds until 330
            : keywordsStart + (i + 1) * perKeywordDuration;

        // Don't render if not in range
        if (frame < kwStart || frame > kwEnd) return null;

        const localFrame = frame - kwStart;

        // Slam-in: scale from 2.5 to 1.0 with heavy spring
        const slamSpring = spring({
          frame: localFrame,
          fps,
          config: {
            damping: SPRING_CONFIG.damping,
            stiffness: SPRING_CONFIG.stiffness,
            mass: SPRING_CONFIG.mass,
          },
        });
        const slamScale = interpolate(slamSpring, [0, 1], [2.5, 1.0]);

        // Fade in with slam
        const fadeIn = interpolate(localFrame, [0, 5], [0, 1], {
          extrapolateRight: 'clamp',
        });

        // Exit: scale down + fade out (only for non-last keywords)
        const exitStart = kwEnd - 10;
        let exitOpacity = 1;
        let exitScale = 1;
        if (i < keywordCount - 1) {
          exitOpacity = interpolate(frame, [exitStart, kwEnd], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          exitScale = interpolate(frame, [exitStart, kwEnd], [1, 0.8], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
        }

        const totalScale = slamScale * exitScale;
        const totalOpacity = fadeIn * exitOpacity;

        // Subtitle fade in (delayed slightly after keyword slams)
        const subtitleOpacity = keyword.subtitle
          ? interpolate(localFrame, [10, 22], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }) * exitOpacity
          : 0;
        const subtitleSlideY = keyword.subtitle
          ? interpolate(localFrame, [10, 22], [20, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;

        return (
          <AbsoluteFill
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: totalOpacity,
            }}
          >
            {/* Keyword text */}
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: 120,
                fontWeight: 900,
                color: theme.text,
                textAlign: 'center',
                lineHeight: 1.1,
                transform: `scale(${totalScale})`,
                textShadow: `0 0 40px ${props.accentColor}80, 0 0 80px ${props.accentColor}40`,
                letterSpacing: '0.02em',
                padding: '0 60px',
                textTransform: 'uppercase',
              }}
            >
              {keyword.word}
            </div>

            {/* Subtitle */}
            {keyword.subtitle && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 32,
                  fontWeight: 400,
                  color: theme.textMuted,
                  textAlign: 'center',
                  marginTop: 24,
                  opacity: subtitleOpacity,
                  transform: `translateY(${subtitleSlideY}px)`,
                  letterSpacing: '0.04em',
                }}
              >
                {keyword.subtitle}
              </div>
            )}
          </AbsoluteFill>
        );
      })}

      {/* Accent color glow overlay behind active keyword */}
      {frame >= keywordsStart && frame <= 330 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 400,
            height: 400,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${props.accentColor}15 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export default KeywordPop;
