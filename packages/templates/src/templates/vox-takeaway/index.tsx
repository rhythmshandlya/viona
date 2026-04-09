import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxTakeawayProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { VoxHeadline, VoxBody } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { ConstructionPaper } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxTakeaway: React.FC<VoxTakeawayProps> = ({ takeaways, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const titleEntrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  const titleOpacity = titleEntrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, takeaways.length);

  // Highlighter sweeps for each number circle
  const sweeps = takeaways.map((_, i) => highlighterSweep(frame, 20 + i * 5));

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.offWhite,
      padding: s(60),
      paddingTop: s(120),
    }}>
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.35} seed={23} />

      {/* Title */}
      <div style={{
        opacity: titleOpacity,
        transform: `translateY(${titleEntrance.translateY + exit.translateY}px)`,
        marginBottom: s(48),
      }}>
        <VoxHeadline
          text={title}
          size={s(VOX_SIZES.h2)}
          color={VOX_COLORS.charcoal}
          accentBar="underline"
          accentColor={VOX_COLORS.highlight}
        />
      </div>

      {/* Takeaway items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        flex: 1,
      }}>
        {takeaways.map((item, i) => {
          const itemEntrance = voxEntrance(frame, 20 + i * 8, undefined, 'up', s(20));
          const itemOpacity = itemOpacities[i] * exit.opacity;

          return (
            <React.Fragment key={i}>
              <div style={{
                opacity: itemOpacity,
                transform: `translateY(${itemEntrance.translateY + exit.translateY}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: s(28),
                paddingTop: s(32),
                paddingBottom: s(32),
              }}>
                {/* Number with highlighter circle */}
                <div style={{
                  position: 'relative',
                  width: s(56),
                  height: s(56),
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <HighlighterMark
                    widthPercent={sweeps[i].widthPercent}
                    height={s(52)}
                    rotation={sweeps[i].rotation}
                    color={VOX_COLORS.highlight}
                    opacity={0.85}
                  />
                  <span style={{
                    fontFamily: VOX_FONTS.body,
                    fontSize: s(VOX_SIZES.h3),
                    fontWeight: 700,
                    color: VOX_COLORS.charcoal,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {i + 1}
                  </span>
                </div>

                {/* Takeaway text */}
                <VoxBody
                  text={item}
                  size={s(VOX_SIZES.body)}
                  color={VOX_COLORS.charcoal}
                />
              </div>

              {/* Divider between items */}
              {i < takeaways.length - 1 && (
                <div style={{ opacity: itemOpacity }}>
                  <RoughDivider length={s(960)} thickness={1} color={VOX_COLORS.lightGray} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxTakeaway;
