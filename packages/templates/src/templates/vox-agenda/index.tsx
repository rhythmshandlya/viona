import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VoxAgendaProps } from './schema';
import { VOX_COLORS, VOX_FONTS } from '../../vox/constants';
import { voxEntrance, highlighterSweep, progressiveBuild } from '../../vox/animations';
import { FilmGrain, HighlighterMark } from '../../vox/effects';
import { ConstructionPaper, NewsprintOverlay } from '../../vox/textures';
import { useScale } from '../../use-scale';

const VoxAgenda: React.FC<VoxAgendaProps> = ({ items, activeIndex }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const s = useScale();

  // Active item entrance: slide up from frame 5
  const activeEntrance = voxEntrance(frame, 5, undefined, 'up', s(24));
  // Highlight sweeps in after item has entered
  const sweep = highlighterSweep(frame, 18, 10);
  // Inactive items build progressively
  const { itemOpacities } = progressiveBuild(frame, 8, items.length);

  const GRID_SPACING = s(30);
  const PAD = s(80);
  const ITEM_GAP = s(40);
  const ACTIVE_FONT_SIZE = s(56);
  const INACTIVE_FONT_SIZE = s(44);
  const ACTIVE_BULLET_SIZE = s(14);
  const INACTIVE_BULLET_SIZE = s(8);

  return (
    <AbsoluteFill style={{ backgroundColor: VOX_COLORS.offWhite, overflow: 'hidden' }}>
      {/* Construction paper base texture */}
      <ConstructionPaper color={VOX_COLORS.offWhite} opacity={0.4} seed={19} />

      {/* Subtle grid overlay */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <pattern
            id="agenda-grid"
            width={GRID_SPACING}
            height={GRID_SPACING}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`}
              fill="none"
              stroke="#C8C8C0"
              strokeWidth={0.5}
              opacity={0.4}
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#agenda-grid)" />
      </svg>

      {/* Faded newsprint overlay for document feel */}
      <NewsprintOverlay opacity={0.04} dotSize={1.5} seed={7} />

      {/* Items: vertically centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: PAD,
          paddingRight: PAD,
          gap: ITEM_GAP,
        }}
      >
        {items.map((item, i) => {
          const isActive = i === activeIndex;

          if (isActive) {
            return (
              <div
                key={i}
                style={{
                  opacity: activeEntrance.opacity,
                  transform: `translateY(${activeEntrance.translateY}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: s(20),
                  width: '100%',
                }}
              >
                {/* Large filled bullet */}
                <div
                  style={{
                    width: ACTIVE_BULLET_SIZE,
                    height: ACTIVE_BULLET_SIZE,
                    borderRadius: '50%',
                    backgroundColor: '#1A1A1A',
                    flexShrink: 0,
                  }}
                />
                {/* Text with yellow highlight behind */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <HighlighterMark
                    widthPercent={sweep.widthPercent}
                    height={ACTIVE_FONT_SIZE * 1.1}
                    rotation={0.5}
                    yOffset={ACTIVE_FONT_SIZE * 0.0}
                    color={VOX_COLORS.highlight}
                    opacity={0.85}
                  />
                  <span
                    style={{
                      fontFamily: VOX_FONTS.headline,
                      fontSize: ACTIVE_FONT_SIZE,
                      fontWeight: 700,
                      color: '#1A1A1A',
                      lineHeight: 1.1,
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {item}
                  </span>
                </div>
              </div>
            );
          }

          // Inactive item
          const opacity = itemOpacities[i] * 0.55;
          return (
            <div
              key={i}
              style={{
                opacity,
                display: 'flex',
                alignItems: 'center',
                gap: s(20),
                width: '100%',
              }}
            >
              {/* Small gray bullet */}
              <div
                style={{
                  width: INACTIVE_BULLET_SIZE,
                  height: INACTIVE_BULLET_SIZE,
                  borderRadius: '50%',
                  backgroundColor: VOX_COLORS.lightGray,
                  flexShrink: 0,
                  marginLeft: (ACTIVE_BULLET_SIZE - INACTIVE_BULLET_SIZE) / 2,
                }}
              />
              <span
                style={{
                  fontFamily: VOX_FONTS.headline,
                  fontSize: INACTIVE_FONT_SIZE,
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: VOX_COLORS.lightGray,
                  lineHeight: 1.1,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>

      {/* Film grain on top */}
      <FilmGrain opacity={0.15} />
    </AbsoluteFill>
  );
};

export default VoxAgenda;
