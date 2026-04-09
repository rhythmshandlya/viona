import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxVerdictProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, highlighterSweep } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxBody } from '../../vox/typography';
import { HighlighterStroke } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const confidenceColor = (confidence: VoxVerdictProps['confidence']): string => {
  if (confidence === 'strong') return VOX_COLORS.highlight;
  if (confidence === 'moderate') return VOX_COLORS.teal;
  return VOX_COLORS.lightGray;
};

const VoxVerdict: React.FC<VoxVerdictProps> = ({ verdict, rationale, confidence }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const accentColor = confidenceColor(confidence);

  const verdictEntrance = voxEntrance(frame, 5, undefined, 'up', s(30));
  const rationaleEntrance = voxEntrance(frame, 18, undefined, 'up', s(20));

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const verdictOpacity = verdictEntrance.opacity * exit.opacity;
  const rationaleOpacity = rationaleEntrance.opacity * exit.opacity;

  // Highlighter stroke for verdict underline
  const { widthPercent } = highlighterSweep(frame, 15);
  const strokeWidth = s(800) * (widthPercent / 100);

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      justifyContent: 'center',
      alignItems: 'center',
      padding: s(60),
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: s(32),
        maxWidth: s(900),
        textAlign: 'center' as const,
      }}>
        {/* Verdict */}
        <div style={{
          opacity: verdictOpacity,
          transform: `translateY(${verdictEntrance.translateY + exit.translateY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: s(12),
        }}>
          <VoxHeadline
            text={verdict}
            size={s(VOX_SIZES.h1)}
            color={VOX_COLORS.white}
            accentBar="none"
          />
          <HighlighterStroke
            width={strokeWidth}
            thickness={s(8)}
            color={accentColor}
          />
        </div>

        {/* Rationale */}
        {rationale && (
          <div style={{
            opacity: rationaleOpacity * 0.7,
            transform: `translateY(${rationaleEntrance.translateY + exit.translateY}px)`,
          }}>
            <VoxBody
              text={rationale}
              size={s(VOX_SIZES.body)}
              color={VOX_COLORS.lightGray}
            />
          </div>
        )}
      </div>

      <FilmGrain opacity={0.4} />
    </AbsoluteFill>
  );
};

export default VoxVerdict;
