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
import type { SpeakerIdProps } from './schema';

const DotGrid: React.FC<{ color: string; width: number; height: number }> = ({
  color,
  width,
  height,
}) => {
  const s = useScale();
  const spacing = s(28);
  const radius = s(1.5);
  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const dots: React.ReactNode[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing}
          cy={r * spacing}
          r={radius}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {dots}
    </svg>
  );
};

const SpeakerId: React.FC<SpeakerIdProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();

  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;
  const accentColor = props.accentColor;

  // --- Animation phases ---

  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 15-35: Lower-third bar slides in from left (spring)
  const barSlideIn = spring({
    frame: frame - 15,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  // 300-330: Bar slides out to left
  const barSlideOut = interpolate(frame, [300, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const easeOutSlide = barSlideOut * barSlideOut; // ease-in for exit

  // Combined bar position: slide in from -100% then slide out to -100%
  const barTranslateX =
    frame < 300
      ? interpolate(barSlideIn, [0, 1], [-100, 0])
      : interpolate(easeOutSlide, [0, 1], [0, -100]);

  // 30-45: Name text fades in
  const nameOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameSlide = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const nameTranslateY = interpolate(nameSlide, [0, 1], [12, 0]);

  // 40-55: Title text fades in with slight delay
  const titleOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleSlide = spring({
    frame: frame - 40,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const titleTranslateY = interpolate(titleSlide, [0, 1], [10, 0]);

  // Company fades in slightly after title
  const companyOpacity = interpolate(frame, [48, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const companySlide = spring({
    frame: frame - 48,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.6 },
  });
  const companyTranslateY = interpolate(companySlide, [0, 1], [8, 0]);

  // Fade out text before bar exits
  const textFadeOut = interpolate(frame, [295, 310], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Final fade out
  const finalFade = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Accent divider line width animation
  const dividerWidth = spring({
    frame: frame - 38,
    fps,
    config: { damping: 22, stiffness: 90, mass: 0.7 },
  });
  const dividerWidthPx = interpolate(dividerWidth, [0, 1], [0, s(120)]);

  // Divider fade out
  const dividerFadeOut = interpolate(frame, [295, 310], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * finalFade,
      }}
    >
      {/* Dot Grid Background */}
      <div style={{ opacity: 0.5 }}>
        <DotGrid color={theme.gridColor} width={width} height={height} />
      </div>

      {/* Lower-third card container */}
      <div
        style={{
          position: 'absolute',
          bottom: s(160),
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'flex-start',
          paddingLeft: s(60),
          paddingRight: s(60),
        }}
      >
        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            transform: `translateX(${barTranslateX}%)`,
            willChange: 'transform',
          }}
        >
          {/* Accent left border */}
          <div
            style={{
              width: s(4),
              backgroundColor: accentColor,
              borderRadius: 2,
              flexShrink: 0,
            }}
          />

          {/* Content area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingLeft: s(28),
              paddingRight: s(48),
              paddingTop: s(24),
              paddingBottom: s(28),
              backgroundColor: `${theme.bg}CC`,
              backdropFilter: 'blur(12px)',
              borderRadius: `0 ${s(8)}px ${s(8)}px 0`,
              minWidth: s(400),
            }}
          >
            {/* Name */}
            <div
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(52),
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.15,
                opacity: nameOpacity * textFadeOut,
                transform: `translateY(${nameTranslateY}px)`,
                letterSpacing: '-0.02em',
              }}
            >
              {props.name}
            </div>

            {/* Accent divider line */}
            <div
              style={{
                width: dividerWidthPx,
                height: s(2),
                backgroundColor: accentColor,
                marginTop: s(14),
                marginBottom: s(14),
                borderRadius: 1,
                opacity: dividerFadeOut,
              }}
            />

            {/* Title */}
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: s(30),
                fontWeight: 400,
                color: theme.textMuted,
                lineHeight: 1.3,
                opacity: titleOpacity * textFadeOut,
                transform: `translateY(${titleTranslateY}px)`,
                letterSpacing: '0.01em',
              }}
            >
              {props.title}
            </div>

            {/* Company */}
            {props.company && (
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: s(22),
                  fontWeight: 400,
                  color: theme.textMuted,
                  lineHeight: 1.3,
                  opacity: companyOpacity * textFadeOut * 0.7,
                  transform: `translateY(${companyTranslateY}px)`,
                  marginTop: s(6),
                  letterSpacing: '0.02em',
                }}
              >
                {props.company}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default SpeakerId;
