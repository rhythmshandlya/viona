import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxFactCheckProps } from './schema';
import { VOX_COLORS, VOX_SIZES, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, voxExit, drawOn, highlighterSweep } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { VoxLabel, VoxSourceBadge } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxFactCheck: React.FC<VoxFactCheckProps> = ({ claim, reality, source }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };

  // Claim enters first
  const claimEntrance = voxEntrance(frame, 8, undefined, 'up', s(30));
  // Strikethrough draws on after a hold (around frame 45)
  const { progress: strikeProgress } = drawOn(frame, 45);
  // Reality card enters after strikethrough is mostly drawn
  const realityEntrance = voxEntrance(frame, 58, undefined, 'up', s(30));
  // Highlighter on first words of reality
  const { widthPercent, rotation } = highlighterSweep(frame, 68);

  const claimOpacity = claimEntrance.opacity * exit.opacity;
  const realityOpacity = realityEntrance.opacity * exit.opacity;

  return (
    <AbsoluteFill style={{
      backgroundColor: VOX_COLORS.deepPurple,
      padding: s(60),
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: s(64),
        width: '100%',
        maxWidth: s(960),
      }}>
        {/* Claim section */}
        <div style={{
          opacity: claimOpacity,
          transform: `translateY(${claimEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxLabel text="CLAIM" color={VOX_COLORS.medGray} />
          <div style={{ position: 'relative', marginTop: s(16) }}>
            <div style={{
              fontFamily: VOX_FONTS.headline,
              fontSize: s(VOX_SIZES.h2),
              fontWeight: 700,
              color: VOX_COLORS.white,
              lineHeight: 1.25,
            }}>
              {claim}
            </div>
            {/* Strikethrough line */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              width: `${strikeProgress * 100}%`,
              height: s(4),
              backgroundColor: VOX_COLORS.mutedRed,
              transform: 'translateY(-50%) rotate(-0.5deg)',
              borderRadius: 2,
            }} />
          </div>
        </div>

        {/* Reality section */}
        <div style={{
          opacity: realityOpacity,
          transform: `translateY(${realityEntrance.translateY + exit.translateY}px)`,
        }}>
          <VoxLabel text="REALITY" color={VOX_COLORS.highlight} />
          <div style={{
            marginTop: s(16),
            padding: s(32),
            border: `2px solid ${VOX_COLORS.teal}`,
            position: 'relative',
          }}>
            {/* Highlighter behind first portion */}
            <div style={{ position: 'relative' }}>
              <HighlighterMark
                widthPercent={widthPercent}
                height={s(48)}
                rotation={rotation}
                color={VOX_COLORS.teal}
                opacity={0.3}
              />
              <div style={{
                fontFamily: VOX_FONTS.body,
                fontSize: s(VOX_SIZES.body),
                fontWeight: 400,
                color: VOX_COLORS.white,
                lineHeight: 1.5,
                position: 'relative',
                zIndex: 1,
              }}>
                {reality}
              </div>
            </div>
          </div>
        </div>
      </div>

      {source && <VoxSourceBadge source={source} position="bottom-left" />}
      <FilmGrain opacity={0.25} seed={7} />
    </AbsoluteFill>
  );
};

export default VoxFactCheck;
