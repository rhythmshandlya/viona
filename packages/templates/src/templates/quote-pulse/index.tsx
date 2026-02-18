import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import type { QuotePulseProps } from './schema';

const QuotePulse: React.FC<QuotePulseProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = BACKGROUNDS[props.background];

  const phrases = props.phrases;
  const phraseCount = phrases.length;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Compute timing for each phrase
  const phraseStart = 15;
  const authorDuration = 50;
  const outDuration = 30;
  const availableFrames = durationInFrames - phraseStart - authorDuration - outDuration;
  const framesPerPhrase = Math.floor(availableFrames / phraseCount);
  const authorEnter = phraseStart + phraseCount * framesPerPhrase;

  // Author attribution
  const authorOpacity = interpolate(frame, [authorEnter, authorEnter + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const authorSlideY = interpolate(frame, [authorEnter, authorEnter + 15], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  // Decorative accent line
  const lineWidth = interpolate(frame, [5, 25], [0, 60], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (props.style === 'stacked') {
    return (
      <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity }}>
        {/* Decorative line */}
        <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', width: lineWidth, height: 3, backgroundColor: props.accentColor, borderRadius: 2 }} />

        {/* Stacked phrases */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 80px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* Open quote mark */}
            <span style={{ fontFamily: FONTS.headline, fontSize: 80, color: props.accentColor, opacity: 0.3, lineHeight: 0.5, marginBottom: 8 }}>&ldquo;</span>

            {phrases.map((phrase, i) => {
              const enterFrame = phraseStart + i * framesPerPhrase;

              const phraseOpacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const slideY = interpolate(frame, [enterFrame, enterFrame + 15], [30, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const isEmphasis = phrase.emphasis;
              const color = isEmphasis ? props.accentColor : theme.text;
              const fontSize = isEmphasis ? 56 : 48;
              const fontWeight = isEmphasis ? 900 : 700;

              return (
                <span
                  key={i}
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize,
                    fontWeight,
                    color,
                    textAlign: 'center',
                    lineHeight: 1.3,
                    opacity: phraseOpacity,
                    transform: `translateY(${slideY}px)`,
                    textShadow: isEmphasis ? `0 0 40px ${props.accentColor}40` : undefined,
                  }}
                >
                  {phrase.text}
                </span>
              );
            })}
          </div>

          {/* Author */}
          {props.author && (
            <div style={{ marginTop: 32, opacity: authorOpacity, transform: `translateY(${authorSlideY}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 40, height: 2, backgroundColor: theme.textMuted, marginBottom: 12 }} />
              <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 500, color: theme.textMuted }}>
                {props.author}
              </span>
              {props.authorTitle && (
                <span style={{ fontFamily: FONTS.body, fontSize: 18, fontWeight: 400, color: theme.textMuted }}>
                  {props.authorTitle}
                </span>
              )}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // "centered" style — one phrase at a time
  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity }}>
      {/* Decorative line */}
      <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', width: lineWidth, height: 3, backgroundColor: props.accentColor, borderRadius: 2 }} />

      {/* Phrases — one at a time */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
        {phrases.map((phrase, i) => {
          const enterFrame = phraseStart + i * framesPerPhrase;
          const exitFrame = enterFrame + framesPerPhrase;
          const fadeInEnd = enterFrame + 12;
          const fadeOutStart = exitFrame - 10;

          const phraseOpacity =
            interpolate(frame, [enterFrame, fadeInEnd], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }) *
            interpolate(frame, [fadeOutStart, exitFrame], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

          const scaleSpring = spring({
            frame: frame - enterFrame,
            fps,
            config: { damping: 20, stiffness: 120, mass: 0.8 },
          });

          const scale = interpolate(scaleSpring, [0, 1], [0.88, phrase.emphasis ? 1.05 : 1.0]);

          if (frame < enterFrame || frame > exitFrame) return null;

          const isEmphasis = phrase.emphasis;
          const color = isEmphasis ? props.accentColor : theme.text;
          const fontSize = isEmphasis ? 72 : 60;

          return (
            <span
              key={i}
              style={{
                fontFamily: FONTS.headline,
                fontSize,
                fontWeight: 800,
                color,
                textAlign: 'center',
                lineHeight: 1.2,
                opacity: phraseOpacity,
                transform: `scale(${scale})`,
                textShadow: isEmphasis ? `0 0 60px ${props.accentColor}50` : undefined,
                position: 'absolute',
              }}
            >
              {phrase.text}
            </span>
          );
        })}
      </div>

      {/* Open quote decorative */}
      <div style={{ position: 'absolute', top: 200, left: 80, opacity: 0.08 }}>
        <span style={{ fontFamily: FONTS.headline, fontSize: 300, color: theme.text, lineHeight: 0.5 }}>&ldquo;</span>
      </div>

      {/* Author */}
      {props.author && (
        <div style={{ position: 'absolute', bottom: 100, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: authorOpacity, transform: `translateY(${authorSlideY}px)` }}>
          <div style={{ width: 40, height: 2, backgroundColor: theme.textMuted, marginBottom: 12 }} />
          <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 500, color: theme.textMuted }}>
            {props.author}
          </span>
          {props.authorTitle && (
            <span style={{ fontFamily: FONTS.body, fontSize: 18, fontWeight: 400, color: theme.textMuted }}>
              {props.authorTitle}
            </span>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default QuotePulse;
