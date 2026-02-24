import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { KineticCaptionProps } from './schema';

const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="kc-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kc-dot-grid)" />
    </svg>
  );
};

const KineticCaption: React.FC<KineticCaptionProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const words = props.text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Normalize highlight words for case-insensitive matching
  const highlightSet = new Set(
    props.highlightWords.map((w) => w.toLowerCase())
  );

  // --- Timeline phases ---
  // 0-15: background fade in
  // 15-300: words appear one by one
  // 300-330: all text holds
  // 330-360: fade out

  const bgFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const outroOpacity = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Each word gets an evenly distributed enter frame between 15 and 300
  const wordPhaseStart = 15;
  const wordPhaseEnd = 300;
  const totalWordFrames = wordPhaseEnd - wordPhaseStart;
  const framesPerWord = totalWordFrames / wordCount;

  // Find which word is currently "active" (most recently appeared)
  const activeWordIndex = Math.min(
    Math.floor((frame - wordPhaseStart) / framesPerWord),
    wordCount - 1
  );

  const fontSize = s(64);
  const lineHeight = 1.4;
  const wordGap = s(16);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgFadeIn * outroOpacity,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Centered text block */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${s(80)}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: `${wordGap}px`,
            maxWidth: s(900),
          }}
        >
          {words.map((word, i) => {
            const wordEnterFrame = wordPhaseStart + i * framesPerWord;

            // Word opacity: fade in over 8 frames
            const wordOpacity = interpolate(
              frame,
              [wordEnterFrame, wordEnterFrame + 8],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            // Word translateY: slide up 20px over 8 frames
            const wordTranslateY = interpolate(
              frame,
              [wordEnterFrame, wordEnterFrame + 8],
              [20, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            // Check if this word is a highlight word
            const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
            const isHighlight = highlightSet.has(cleanWord);

            // Active word: the most recently entered word (during word phase)
            const isActive = i === activeWordIndex && frame >= wordPhaseStart && frame < wordPhaseEnd;

            // Scale for highlight + active words
            let scale = 1;
            if (isHighlight && wordOpacity > 0) {
              scale = 1.15;
            } else if (isActive) {
              scale = 1.1;
            }

            // Determine color
            let color = theme.text;
            if (isHighlight && wordOpacity > 0) {
              color = props.accentColor;
            } else if (isActive) {
              color = props.accentColor;
            }

            // Text shadow glow for highlight words
            const textShadow =
              isHighlight && wordOpacity > 0
                ? `0 0 ${s(30)}px ${props.accentColor}60, 0 0 ${s(60)}px ${props.accentColor}30`
                : undefined;

            return (
              <span
                key={i}
                style={{
                  fontFamily: FONTS.headline,
                  fontSize,
                  fontWeight: 800,
                  color,
                  lineHeight,
                  opacity: wordOpacity,
                  transform: `translateY(${wordTranslateY}px) scale(${scale})`,
                  display: 'inline-block',
                  textShadow,
                  transition: 'color 0.1s, transform 0.1s',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default KineticCaption;
