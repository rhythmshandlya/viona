import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxWordswapProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const SWAP_FRAME = 75;

const VoxWordswap: React.FC<VoxWordswapProps> = ({ sentence, wordA, wordB }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  // Parse sentence into parts: before {word}, and after {word}
  const placeholder = '{word}';
  const placeholderIdx = sentence.indexOf(placeholder);
  const before = placeholderIdx >= 0 ? sentence.slice(0, placeholderIdx) : sentence;
  const after = placeholderIdx >= 0 ? sentence.slice(placeholderIdx + placeholder.length) : '';

  // Overall scene entrance
  const entrance = voxEntrance(frame, 5, undefined, 'up', s(30));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY;

  // WordA: visible from frame 5 to SWAP_FRAME, then exits
  const wordAOpacity = interpolate(frame, [SWAP_FRAME - 8, SWAP_FRAME], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordAY = interpolate(frame, [SWAP_FRAME - 8, SWAP_FRAME], [0, s(15)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // WordB: enters at SWAP_FRAME
  const wordBEntrance = voxEntrance(frame, SWAP_FRAME, undefined, 'up', s(20));

  // Highlighter for wordA (sweeps in with entrance)
  const { widthPercent: wAPercent, rotation: wARot } = highlighterSweep(frame, 12, 10);
  // Highlighter for wordB (sweeps in at swap)
  const { widthPercent: wBPercent, rotation: wBRot } = highlighterSweep(frame, SWAP_FRAME + 5, 10);

  const wordBOpacity = wordBEntrance.opacity * exit.opacity;

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(60),
    }}>
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.25} seed={53} />

      <div style={{
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
        maxWidth: s(900),
        textAlign: 'center' as const,
      }}>
        {/* Static sentence parts + swapping word inline */}
        <div style={{
          fontFamily: VOX_FONTS.headline,
          fontSize: s(VOX_SIZES.h1),
          fontWeight: 700,
          color: VOX_COLORS.white,
          lineHeight: 1.3,
        }}>
          {before}
          {/* Word container — fixed size to prevent layout shift */}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            {/* WordA */}
            <span style={{
              opacity: wordAOpacity,
              transform: `translateY(${wordAY}px)`,
              display: 'inline-block',
              position: 'relative',
            }}>
              <HighlighterMark
                widthPercent={wAPercent}
                height={s(60)}
                rotation={wARot}
                color={VOX_COLORS.highlight}
                opacity={0.85}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>{wordA}</span>
            </span>

            {/* WordB — positioned absolutely over wordA */}
            <span style={{
              opacity: wordBOpacity,
              transform: `translateY(${wordBEntrance.translateY}px)`,
              display: 'inline-block',
              position: 'absolute',
              left: 0,
              top: 0,
              whiteSpace: 'nowrap' as const,
            }}>
              <HighlighterMark
                widthPercent={wBPercent}
                height={s(60)}
                rotation={wBRot}
                color={VOX_COLORS.highlight}
                opacity={0.85}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>{wordB}</span>
            </span>
          </span>
          {after}
        </div>
      </div>

      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export default VoxWordswap;
