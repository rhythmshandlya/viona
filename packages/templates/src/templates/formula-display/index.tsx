import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { FormulaDisplayProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  );
};

const FormulaDisplay: React.FC<FormulaDisplayProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  // --- Animation timeline ---
  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 15-30: Title fades in
  const titleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleSlideY = interpolate(frame, [15, 30], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 30-50: Formula container appears
  const containerOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const containerScale = interpolate(frame, [30, 50], [0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 50-150: Formula parts reveal with stagger
  const partCount = props.formulaParts.length;
  const staggerPerPart = partCount > 1 ? (150 - 50) / partCount : 100;

  // 150-180: Variables section fades in
  const variablesOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const variablesSlideY = interpolate(frame, [150, 180], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 150-180: Description fades in (slightly after variables start)
  const descriptionOpacity = interpolate(frame, [160, 185], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 310-340: Elements fade out
  const elementsOutOpacity = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Final fade out
  const finalOutOpacity = interpolate(
    frame,
    [330, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * finalOutOpacity,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(80),
          opacity: elementsOutOpacity,
        }}
      >
        {/* Title / Label */}
        {props.title && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: s(26),
              fontWeight: 500,
              letterSpacing: s(4),
              color: theme.textMuted,
              textTransform: 'uppercase',
              textAlign: 'center',
              opacity: titleOpacity,
              transform: `translateY(${titleSlideY}px)`,
              marginBottom: s(48),
            }}
          >
            {props.title}
          </div>
        )}

        {/* Formula Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${s(40)}px ${s(64)}px`,
            borderRadius: s(20),
            backgroundColor: theme.containerBg,
            border: `1px solid ${theme.containerBorder}`,
            opacity: containerOpacity,
            transform: `scale(${containerScale})`,
          }}
        >
          {/* Formula Parts */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {props.formulaParts.map((part, index) => {
              const partStart = 50 + index * staggerPerPart;
              const partEnd = partStart + 25;

              const partOpacity = interpolate(frame, [partStart, partEnd], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const partSlideX = interpolate(frame, [partStart, partEnd], [-20, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const isHighlighted = part.isHighlight === true;

              return (
                <span
                  key={index}
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: s(88),
                    fontWeight: 700,
                    color: isHighlighted ? props.accentColor : theme.text,
                    lineHeight: 1.2,
                    opacity: partOpacity,
                    transform: `translateX(${partSlideX}px)`,
                    whiteSpace: 'pre',
                  }}
                >
                  {part.text}
                </span>
              );
            })}
          </div>
        </div>

        {/* Variables "where" section */}
        {props.variables && props.variables.length > 0 && (
          <div
            style={{
              marginTop: s(48),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: s(14),
              opacity: variablesOpacity,
              transform: `translateY(${variablesSlideY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(20),
                fontWeight: 400,
                fontStyle: 'italic',
                color: theme.textMuted,
                marginBottom: s(6),
              }}
            >
              where
            </span>

            {props.variables.map((variable, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: s(12),
                }}
              >
                <span
                  style={{
                    width: s(6),
                    height: s(6),
                    borderRadius: '50%',
                    backgroundColor: props.accentColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: s(24),
                    fontWeight: 700,
                    color: props.accentColor,
                  }}
                >
                  {variable.symbol}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: s(22),
                    fontWeight: 400,
                    color: theme.textMuted,
                  }}
                >
                  = {variable.meaning}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {props.description && (
          <div
            style={{
              marginTop: s(40),
              fontFamily: FONTS.body,
              fontSize: s(22),
              fontWeight: 400,
              color: theme.textMuted,
              textAlign: 'center',
              maxWidth: s(700),
              lineHeight: 1.5,
              opacity: descriptionOpacity,
            }}
          >
            {props.description}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default FormulaDisplay;
