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
import type { FeatureListProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Dot-grid SVG background pattern                                    */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <defs>
        <pattern id="dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(2)} cy={s(2)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Single feature row                                                 */
/* ------------------------------------------------------------------ */
interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  headlineFont: string;
  bodyFont: string;
  progress: number; // 0-1, driven by spring
  accentHeight: number; // 0-1, for accent bar grow
}

const FeatureItem: React.FC<FeatureItemProps> = ({
  icon,
  title,
  description,
  accentColor,
  textColor,
  mutedColor,
  headlineFont,
  bodyFont,
  progress,
  accentHeight,
}) => {
  const s = useScale();
  const translateX = interpolate(progress, [0, 1], [s(120), 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const barHeight = interpolate(accentHeight, [0, 1], [0, 100]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(24),
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: s(4),
          height: `${barHeight}%`,
          backgroundColor: accentColor,
          borderRadius: s(2),
          flexShrink: 0,
          alignSelf: 'stretch',
          minHeight: 0,
        }}
      />

      {/* Icon */}
      <div
        style={{
          fontSize: s(48),
          lineHeight: 1,
          flexShrink: 0,
          width: s(60),
          textAlign: 'center',
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: s(6) }}>
        <div
          style={{
            fontFamily: headlineFont,
            fontWeight: 700,
            fontSize: s(32),
            color: textColor,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: s(22),
            color: mutedColor,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main composition                                                   */
/* ------------------------------------------------------------------ */
const FeatureList: React.FC<FeatureListProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const { FONTS } = getConstants(props);
  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;

  /* ---- global intro / outro opacity ---- */
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const globalOpacity = introOpacity * outroOpacity;

  /* ---- heading entrance ---- */
  const headingProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.8 },
  });
  const headingY = interpolate(headingProgress, [0, 1], [40, 0]);
  const headingOpacity = interpolate(headingProgress, [0, 1], [0, 1]);

  /* ---- feature items stagger ---- */
  const STAGGER_DELAY = 25;
  const FIRST_ITEM_START = 30;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: globalOpacity,
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={theme.gridColor} />

      {/* Content container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: `${s(80)}px ${s(72)}px`,
        }}
      >
        {/* Heading */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 800,
            fontSize: s(56),
            color: theme.text,
            marginBottom: s(60),
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
            textAlign: 'center',
          }}
        >
          {props.heading}
        </div>

        {/* Feature items */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: s(40),
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {props.features.map((feature, index) => {
            const itemStart = FIRST_ITEM_START + index * STAGGER_DELAY;

            const slideProgress = spring({
              frame: frame - itemStart,
              fps,
              config: { damping: 16, stiffness: 100, mass: 0.7 },
            });

            // Accent bar grows slightly after the item lands
            const accentProgress = spring({
              frame: frame - (itemStart + 8),
              fps,
              config: { damping: 20, stiffness: 120, mass: 0.5 },
            });

            return (
              <FeatureItem
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                accentColor={props.accentColor}
                textColor={theme.text}
                mutedColor={theme.textMuted}
                headlineFont={FONTS.headline}
                bodyFont={FONTS.body}
                progress={slideProgress}
                accentHeight={accentProgress}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default FeatureList;
