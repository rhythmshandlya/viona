import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { FactFlashProps } from './schema';

const FactFlash: React.FC<FactFlashProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];
  const facts = props.facts;
  const factCount = facts.length;

  const introOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 25, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Tagline
  const taglineOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fact timing
  const factsStart = 18;
  const factsEnd = durationInFrames - 30;
  const framesPerFact = Math.floor((factsEnd - factsStart) / factCount);

  const currentFactIdx = Math.min(Math.floor((frame - factsStart) / framesPerFact), factCount - 1);

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity }}>
      {/* Tagline */}
      <div style={{ position: 'absolute', top: s(80), left: 0, right: 0, textAlign: 'center', opacity: taglineOpacity }}>
        <span style={{
          fontFamily: FONTS.body,
          fontSize: s(20),
          fontWeight: 600,
          letterSpacing: s(4),
          color: props.accentColor,
          textTransform: 'uppercase',
        }}>{props.tagline}</span>
      </div>

      {/* Facts */}
      {facts.map((fact, i) => {
        const factEnter = factsStart + i * framesPerFact;
        const factExit = factEnter + framesPerFact;
        const localFrame = frame - factEnter;

        if (frame < factEnter || frame >= factExit + 5) return null;

        // Number animation
        const numScale = spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
        const numDisplayScale = interpolate(numScale, [0, 1], [1.6, 1.0]);
        const numOpacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Label
        const labelOpacity = interpolate(localFrame, [8, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const labelSlide = interpolate(localFrame, [8, 18], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Context
        const contextOpacity = interpolate(localFrame, [15, 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Exit
        const exitOpacity = interpolate(localFrame, [framesPerFact - 12, framesPerFact], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const exitScale = interpolate(localFrame, [framesPerFact - 12, framesPerFact], [1, 0.92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        return (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: s(16), padding: `0 ${s(80)}px`,
            opacity: exitOpacity, transform: `scale(${exitScale})`,
          }}>
            {/* Big number */}
            <span style={{
              fontFamily: FONTS.headline,
              fontSize: s(140),
              fontWeight: 900,
              color: props.accentColor,
              lineHeight: 1,
              opacity: numOpacity,
              transform: `scale(${numDisplayScale})`,
              textShadow: `0 0 ${s(40)}px ${props.accentColor}30`,
            }}>{fact.number}</span>

            {/* Label */}
            <span style={{
              fontFamily: FONTS.headline,
              fontSize: s(36),
              fontWeight: 700,
              color: theme.text,
              opacity: labelOpacity,
              transform: `translateY(${labelSlide}px)`,
            }}>{fact.label}</span>

            {/* Context */}
            {fact.context && (
              <span style={{
                fontFamily: FONTS.body,
                fontSize: s(22),
                fontWeight: 400,
                color: theme.textMuted,
                textAlign: 'center',
                opacity: contextOpacity,
                maxWidth: s(600),
              }}>{fact.context}</span>
            )}
          </div>
        );
      })}

      {/* Progress dots */}
      {frame >= factsStart && (
        <div style={{ position: 'absolute', bottom: s(60), left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: s(10) }}>
          {facts.map((_, i) => (
            <div key={i} style={{
              width: i === currentFactIdx ? s(24) : s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: i === currentFactIdx ? props.accentColor : `${theme.text}20`,
            }} />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default FactFlash;
