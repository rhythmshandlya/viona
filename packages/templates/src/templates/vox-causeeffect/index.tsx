import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxCauseEffectProps } from './schema';
import { VOX_COLORS, VOX_SIZES } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, drawOn } from '../../vox/animations';
import { FilmGrain, RoughEdgeMask } from '../../vox/effects';
import { VoxHeadline, VoxBody } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxCauseEffect: React.FC<VoxCauseEffectProps> = ({ chain, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, chain.length);

  const BOX_HEIGHT = s(120);
  const BOX_MARGIN_X = s(80);
  const ARROW_HEIGHT = s(60);
  const LIST_TOP = s(280);
  const ITEM_TOTAL = BOX_HEIGHT + ARROW_HEIGHT;

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite }}>
      {/* Title */}
      <div style={{
        position: 'absolute',
        top: s(80),
        left: s(60),
        right: s(60),
        opacity: combinedOpacity,
        transform: `translateY(${entrance.translateY + exit.translateY}px)`,
      }}>
        {title && (
          <VoxHeadline
            text={title}
            size={s(VOX_SIZES.h3)}
            color={VOX_COLORS.charcoal}
            accentBar="left"
          />
        )}
      </div>

      {/* SVG arrows between boxes */}
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="none"
      >
        {chain.slice(0, -1).map((_, i) => {
          const arrowProgress = drawOn(frame, 20 + (i + 1) * 5).progress;
          const arrowOpacity = itemOpacities[i] * combinedOpacity;
          const y1 = LIST_TOP + i * ITEM_TOTAL + BOX_HEIGHT;
          const y2 = LIST_TOP + (i + 1) * ITEM_TOTAL;
          const midY = y1 + (y2 - y1) * arrowProgress;
          const centerX = 540;
          const headSize = s(12);
          // Arrowhead only when line is fully drawn
          const showHead = arrowProgress > 0.9;
          return (
            <g key={i} opacity={arrowOpacity}>
              <line
                x1={centerX}
                y1={y1}
                x2={centerX}
                y2={midY}
                stroke={VOX_COLORS.teal}
                strokeWidth={s(3)}
              />
              {showHead && (
                <polygon
                  points={`${centerX},${y2} ${centerX - headSize / 2},${y2 - headSize} ${centerX + headSize / 2},${y2 - headSize}`}
                  fill={VOX_COLORS.teal}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Chain boxes */}
      {chain.map((item, i) => {
        const isLast = i === chain.length - 1;
        const boxTop = LIST_TOP + i * ITEM_TOTAL;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: boxTop,
              left: BOX_MARGIN_X,
              right: BOX_MARGIN_X,
              opacity: itemOpacities[i] * combinedOpacity,
            }}
          >
            <RoughEdgeMask seed={i * 17 + 3}>
              <div style={{
                height: BOX_HEIGHT,
                backgroundColor: isLast ? VOX_COLORS.highlight : VOX_COLORS.offWhite,
                border: `${s(2)}px solid ${isLast ? VOX_COLORS.highlight : VOX_COLORS.charcoal}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: `0 ${s(24)}px`,
                boxSizing: 'border-box',
              }}>
                <span style={{
                  fontFamily: 'Inter',
                  fontSize: s(VOX_SIZES.body),
                  fontWeight: isLast ? 700 : 600,
                  color: VOX_COLORS.charcoal,
                  textAlign: 'center',
                }}>
                  {item.label}
                </span>
                {item.detail && (
                  <span style={{
                    fontFamily: 'Inter',
                    fontSize: s(VOX_SIZES.label),
                    color: VOX_COLORS.medGray,
                    marginTop: s(6),
                    textAlign: 'center',
                  }}>
                    {item.detail}
                  </span>
                )}
              </div>
            </RoughEdgeMask>
          </div>
        );
      })}

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxCauseEffect;
