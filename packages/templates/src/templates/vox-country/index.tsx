import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxCountryProps } from './schema';
import { VOX_COLORS, VOX_SIZES, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, highlighterSweep } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { ConstructionPaper } from '../../vox/textures';
import { VoxHeadline, VoxLabel, VoxBody } from '../../vox/typography';
import { RoughDivider } from '../../vox/decorations';
import { useScale } from '../../use-scale';

const VoxCountry: React.FC<VoxCountryProps> = ({ country, stats, accentColor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const accent = accentColor ?? VOX_COLORS.highlight;

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;
  const combinedY = entrance.translateY + exit.translateY;

  // Yellow accent underline sweeps after country name appears
  const { widthPercent } = highlighterSweep(frame, 20);

  // Stats stagger in progressively (using default 5-frame stagger)
  const { itemOpacities } = progressiveBuild(frame, 35, stats.length);

  // Value bold entrance per stat
  const statValueOpacities = stats.map((_, i) => {
    const start = 35 + i * 5;
    return interpolate(frame, [start, start + 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: voxEaseOut,
    });
  });

  const CONTENT_TOP = s(280);
  const STAT_SPACING = s(160);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.deepPurple }}>
      <ConstructionPaper color={VOX_COLORS.deepPurple} opacity={0.3} seed={21} />

      {/* Country name */}
      <div style={{
        position: 'absolute',
        top: s(100),
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <VoxHeadline
            text={country}
            size={s(VOX_SIZES.hero)}
            color={VOX_COLORS.white}
            accentBar="none"
          />
          {/* Yellow underline accent */}
          <div style={{
            height: s(6),
            width: `${widthPercent}%`,
            backgroundColor: accent,
            marginTop: s(8),
            borderRadius: s(2),
            opacity: 0.9,
          }} />
        </div>
      </div>

      {/* Stats list */}
      <div style={{
        position: 'absolute',
        top: CONTENT_TOP,
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${combinedY}px)`,
      }}>
        {stats.map((stat, i) => (
          <div key={i}>
            {/* Divider above each stat (after first) */}
            {i > 0 && (
              <div style={{ marginBottom: s(20) }}>
                <RoughDivider length={s(960)} color={VOX_COLORS.charcoal} thickness={s(2)} />
              </div>
            )}

            <div style={{
              opacity: itemOpacities[i],
              marginBottom: s(20),
            }}>
              {/* Value — VoxCounter style */}
              <div style={{
                opacity: statValueOpacities[i],
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.h1),
                fontWeight: 700,
                color: VOX_COLORS.white,
                lineHeight: 1.1,
              }}>
                {stat.value}
              </div>

              {/* Label */}
              <div style={{ marginTop: s(4) }}>
                <VoxLabel text={stat.label} color={VOX_COLORS.medGray} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <FilmGrain opacity={0.3} />
    </AbsoluteFill>
  );
};

export default VoxCountry;
