import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { SourceCiteProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="sc-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sc-dot-grid)" />
    </svg>
  );
};

const SourceCite: React.FC<SourceCiteProps> = (props) => {
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

  // 15-30: Card container fades in
  const cardOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardScale = interpolate(frame, [15, 30], [0.97, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 25-40: Left accent border draws downward
  const borderHeight = interpolate(frame, [25, 40], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 30-50: "SOURCE" label fades in
  const labelOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelSlideY = interpolate(frame, [30, 50], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 40-80: Quote text fades in line by line
  // Split the quote into logical lines (~50 chars each)
  const quoteLines = splitIntoLines(props.quote, 45);
  const lineCount = quoteLines.length;
  const lineEnterDuration = (80 - 40) / Math.max(lineCount, 1);

  // 80-100: Source attribution slides in from bottom
  const attrOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const attrSlideY = interpolate(frame, [80, 100], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 310-340: Card fades out
  const cardOutOpacity = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Full fade out
  const outroOpacity = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgStyle: React.CSSProperties = {
    backgroundColor: theme.bg,
  };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: bgOpacity * outroOpacity, overflow: 'hidden' }}>
      <DotGrid color={theme.gridColor} />

      {/* Card container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: s(80),
          opacity: cardOpacity * cardOutOpacity,
          transform: `scale(${cardScale})`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: s(16),
            padding: `${s(56)}px ${s(64)}px ${s(52)}px ${s(64)}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: s(32),
          }}
        >
          {/* Left accent border bar */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: s(40),
              width: s(4),
              height: `${borderHeight}%`,
              backgroundColor: props.accentColor,
              borderRadius: s(2),
              maxHeight: `calc(100% - ${s(80)}px)`,
            }}
          />

          {/* "SOURCE" pill badge */}
          <div
            style={{
              opacity: labelOpacity,
              transform: `translateY(${labelSlideY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(13),
                fontWeight: 700,
                letterSpacing: s(2.5),
                textTransform: 'uppercase',
                color: props.accentColor,
                backgroundColor: theme.badgeBg,
                padding: `${s(6)}px ${s(16)}px`,
                borderRadius: s(20),
                display: 'inline-block',
              }}
            >
              SOURCE
            </span>
          </div>

          {/* Large decorative open quote */}
          <div
            style={{
              position: 'absolute',
              top: s(36),
              right: s(52),
              opacity: 0.06,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: FONTS.headline,
                fontSize: s(200),
                lineHeight: 0.8,
                color: theme.text,
              }}
            >
              {'\u201C'}
            </span>
          </div>

          {/* Quote text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: s(4), paddingLeft: s(20) }}>
            {/* Opening quotation mark inline with text */}
            {quoteLines.map((line, i) => {
              const lineEnterStart = 40 + i * lineEnterDuration;
              const lineEnterEnd = lineEnterStart + 15;

              const lineOpacity = interpolate(frame, [lineEnterStart, lineEnterEnd], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const lineSlideY = interpolate(frame, [lineEnterStart, lineEnterEnd], [12, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const isFirst = i === 0;
              const isLast = i === lineCount - 1;

              return (
                <span
                  key={i}
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: s(36),
                    fontWeight: 500,
                    fontStyle: 'italic',
                    color: theme.text,
                    lineHeight: 1.55,
                    opacity: lineOpacity,
                    transform: `translateY(${lineSlideY}px)`,
                  }}
                >
                  {isFirst ? '\u201C' : ''}
                  {line}
                  {isLast ? '\u201D' : ''}
                </span>
              );
            })}
          </div>

          {/* Thin separator */}
          <div
            style={{
              width: s(48),
              height: 1,
              backgroundColor: theme.textMuted,
              marginLeft: s(20),
              opacity: attrOpacity,
            }}
          />

          {/* Source attribution */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: s(6),
              paddingLeft: s(20),
              opacity: attrOpacity,
              transform: `translateY(${attrSlideY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(22),
                fontWeight: 600,
                color: theme.text,
              }}
            >
              {props.author}
            </span>
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(18),
                fontWeight: 400,
                color: theme.textMuted,
              }}
            >
              {props.publication}
              {props.date ? ` \u2022 ${props.date}` : ''}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Split text into lines of approximately `maxChars` characters,
 * breaking on word boundaries.
 */
function splitIntoLines(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length === 0 ? word : `${current} ${word}`;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

export default SourceCite;
