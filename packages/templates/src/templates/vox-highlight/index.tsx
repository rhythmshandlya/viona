import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxHighlightProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, voxIdle, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { VoxBody, VoxSourceBadge } from '../../vox/typography';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxHighlight: React.FC<VoxHighlightProps> = ({ text, highlightPhrase, source }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const idle = voxIdle(frame, 42);

  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY + idle.translateY;

  // Highlighter sweeps in 10 frames after text entrance
  const sweep = highlighterSweep(frame, 20);

  // Split text around the highlight phrase
  const phraseIndex = text.indexOf(highlightPhrase);
  const beforeText = phraseIndex >= 0 ? text.slice(0, phraseIndex) : text;
  const afterText = phraseIndex >= 0 ? text.slice(phraseIndex + highlightPhrase.length) : '';
  const hasPhrase = phraseIndex >= 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: VOX_COLORS.offWhite,
        justifyContent: 'center',
        alignItems: 'center',
        padding: s(60),
      }}
    >
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.4} seed={3} />
      <div
        style={{
          opacity: combinedOpacity,
          transform: `translateY(${combinedY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          maxWidth: s(900),
        }}
      >
        <div
          style={{
            fontFamily: 'Playfair Display',
            fontSize: s(VOX_SIZES.h2),
            fontWeight: 700,
            color: VOX_COLORS.charcoal,
            lineHeight: 1.45,
          }}
        >
          {hasPhrase ? (
            <>
              {beforeText}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <HighlighterMark
                  widthPercent={sweep.widthPercent}
                  height={s(VOX_SIZES.h2) * 1.1}
                  rotation={sweep.rotation}
                  yOffset={s(4)}
                />
                {highlightPhrase}
              </span>
              {afterText}
            </>
          ) : (
            text
          )}
        </div>
      </div>
      {source && <VoxSourceBadge source={source} />}
      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxHighlight;
