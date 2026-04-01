import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { DepthKeyPhraseProps } from './schema';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const DepthKeyPhrase: React.FC<DepthKeyPhraseProps> = ({
  phrase,
  attribution,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { centerPx, bboxPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // --- Phrase slides in from right and fades in ---
  const phraseEnterStart = 5;
  const phraseEnterDuration = 30;

  const phraseOpacity = interpolate(
    frame,
    [phraseEnterStart, phraseEnterStart + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const phraseSlideX = interpolate(
    frame,
    [phraseEnterStart, phraseEnterStart + phraseEnterDuration],
    [80, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // --- Subtle breathing animation after entrance ---
  const breatheStart = phraseEnterStart + phraseEnterDuration + 10;
  const breatheActive = frame > breatheStart ? 1 : 0;
  const breatheScale = 1 + breatheActive * Math.sin(frame * 0.03) * 0.015;

  // --- Attribution fade in ---
  const attrDelay = phraseEnterStart + phraseEnterDuration + 5;
  const attrOpacity = interpolate(
    frame,
    [attrDelay, attrDelay + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const attrSlideY = interpolate(
    frame,
    [attrDelay, attrDelay + 15],
    [16, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease),
    },
  );

  // Position phrase centered on speaker chest area
  const phraseY = centerPx.y - 40;
  const phraseMaxW = CANVAS_W - 100;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Key phrase — fills background behind speaker */}
      <div
        style={{
          position: 'absolute',
          top: phraseY,
          left: CANVAS_W / 2,
          transform: `translate(-50%, -50%) translateX(${phraseSlideX}px) scale(${breatheScale})`,
          transformOrigin: 'center center',
          opacity: phraseOpacity,
          width: phraseMaxW,
          willChange: 'transform, opacity',
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1.15,
            color: 'rgba(255, 255, 255, 0.88)',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
            letterSpacing: -1,
            wordBreak: 'break-word',
          }}
        >
          {phrase}
        </div>
      </div>

      {/* Attribution — positioned below the speaker bbox in the visible bottom zone */}
      {attribution && (
        <div
          style={{
            position: 'absolute',
            top: bboxPx.y + bboxPx.h + 50,
            left: CANVAS_W / 2,
            transform: `translate(-50%, ${attrSlideY}px)`,
            opacity: attrOpacity,
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 400,
              fontStyle: 'italic',
              fontSize: 34,
              lineHeight: 1.3,
              color: 'rgba(255, 255, 255, 0.7)',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
              maxWidth: 600,
            }}
          >
            {attribution}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default DepthKeyPhrase;
