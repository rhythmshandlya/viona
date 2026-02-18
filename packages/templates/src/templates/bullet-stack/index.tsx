import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { BulletStackProps } from './schema';

/* ------------------------------------------------------------------ */
/*  Dot-grid SVG background pattern                                    */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: 'absolute', top: 0, left: 0 }}
  >
    <defs>
      <pattern id="bullet-dot-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill={color} />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bullet-dot-grid)" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  SVG marker icons                                                   */
/* ------------------------------------------------------------------ */
const CheckmarkIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 13l4 4L19 7"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DotIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="6" fill={color} />
  </svg>
);

const NumberIcon: React.FC<{
  color: string;
  size: number;
  number: number;
  font: string;
}> = ({ color, size, number, font }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <text
      x="12"
      y="12"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontFamily={font}
      fontWeight={700}
      fontSize="14"
    >
      {number}
    </text>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Single bullet item                                                 */
/* ------------------------------------------------------------------ */
interface BulletItemProps {
  text: string;
  index: number;
  isActive: boolean;
  markerStyle: 'checkmark' | 'number' | 'dot';
  accentColor: string;
  textColor: string;
  mutedColor: string;
  headlineFont: string;
  bodyFont: string;
  markerScale: number;
  textProgress: number;
}

const BulletItem: React.FC<BulletItemProps> = ({
  text,
  index,
  isActive,
  markerStyle,
  accentColor,
  textColor,
  mutedColor,
  headlineFont,
  bodyFont,
  markerScale,
  textProgress,
}) => {
  const translateX = interpolate(textProgress, [0, 1], [80, 0]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const markerSize = 36;

  const markerColor = isActive ? accentColor : mutedColor;
  const itemTextColor = isActive ? textColor : mutedColor;

  const renderMarker = () => {
    switch (markerStyle) {
      case 'checkmark':
        return <CheckmarkIcon color={markerColor} size={markerSize} />;
      case 'number':
        return (
          <NumberIcon
            color={markerColor}
            size={markerSize}
            number={index + 1}
            font={headlineFont}
          />
        );
      case 'dot':
        return <DotIcon color={markerColor} size={markerSize} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 28,
        opacity: textOpacity,
      }}
    >
      {/* Marker */}
      <div
        style={{
          width: markerSize + 16,
          height: markerSize + 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: `scale(${markerScale})`,
          backgroundColor: isActive
            ? `${accentColor}18`
            : 'transparent',
          borderRadius: 12,
          border: `2px solid ${isActive ? accentColor : `${mutedColor}40`}`,
        }}
      >
        {renderMarker()}
      </div>

      {/* Text */}
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: isActive ? 600 : 400,
          fontSize: 36,
          color: itemTextColor,
          lineHeight: 1.4,
          transform: `translateX(${translateX}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main composition                                                   */
/* ------------------------------------------------------------------ */
const BulletStack: React.FC<BulletStackProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { FONTS } = getConstants(props);
  const theme = BACKGROUNDS[props.background] ?? BACKGROUNDS.dark;

  const itemCount = props.items.length;

  /* ---- global background fade in ---- */
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  /* ---- outro fade ---- */
  const outroOpacity = interpolate(
    frame,
    [330, 360],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const globalOpacity = bgOpacity * outroOpacity;

  /* ---- title entrance ---- */
  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 80, mass: 0.8 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  /* ---- item cascade timing ---- */
  const STAGGER_DELAY = 30;
  const FIRST_ITEM_START = 30;

  // Determine which item is the "active" (most recently appearing) one
  const activeItemIndex = Math.min(
    Math.floor(Math.max(0, frame - FIRST_ITEM_START) / STAGGER_DELAY),
    itemCount - 1,
  );

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
          padding: '80px 72px',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: FONTS.headline,
            fontWeight: 800,
            fontSize: 56,
            color: theme.text,
            marginBottom: 60,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {props.title}
        </div>

        {/* Bullet items */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {props.items.map((item, index) => {
            const itemStart = FIRST_ITEM_START + index * STAGGER_DELAY;

            // Marker appears with scale spring
            const markerScale = spring({
              frame: frame - itemStart,
              fps,
              config: { damping: 14, stiffness: 120, mass: 0.6 },
            });

            // Text slides in from left slightly after marker
            const textProgress = spring({
              frame: frame - (itemStart + 5),
              fps,
              config: { damping: 16, stiffness: 100, mass: 0.7 },
            });

            const isActive = index === activeItemIndex;

            return (
              <BulletItem
                key={index}
                text={item}
                index={index}
                isActive={isActive}
                markerStyle={props.markerStyle}
                accentColor={props.accentColor}
                textColor={theme.text}
                mutedColor={theme.textMuted}
                headlineFont={FONTS.headline}
                bodyFont={FONTS.body}
                markerScale={markerScale}
                textProgress={textProgress}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default BulletStack;
