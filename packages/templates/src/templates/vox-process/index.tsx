import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { VoxProcessProps } from './schema';
import { VOX_COLORS, VOX_SIZES, sf, voxEaseOut } from '../../vox/constants';
import { voxEntrance, voxExit, progressiveBuild, drawOn } from '../../vox/animations';
import { FilmGrain } from '../../vox/effects';
import { VoxHeadline, VoxLabel, VoxBody } from '../../vox/typography';
import { useScale } from '../../use-scale';

const VoxProcess: React.FC<VoxProcessProps> = ({ steps, title }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const entrance = voxEntrance(frame, 5, undefined, 'up', s(20));
  const exitStart = durationInFrames - 12;
  const exit = frame >= exitStart ? voxExit(frame, exitStart) : { opacity: 1, translateY: 0 };
  const combinedOpacity = entrance.opacity * exit.opacity;

  const { itemOpacities } = progressiveBuild(frame, 20, steps.length);

  const STEP_SPACING = s(210);
  const LIST_TOP = s(280);
  const NUMBER_SIZE = s(56);
  const LINE_X = s(90);
  const CONTENT_LEFT = s(160);

  // Lines between steps draw on progressively
  const lineStarts = steps.slice(0, -1).map((_, i) => 20 + (i + 1) * 5);

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

      {/* SVG connecting lines */}
      <svg
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        width="100%"
        height="100%"
        viewBox="0 0 1080 1920"
        preserveAspectRatio="none"
      >
        {steps.slice(0, -1).map((_, i) => {
          const lineProgress = drawOn(frame, lineStarts[i]).progress;
          const y1 = LIST_TOP + i * STEP_SPACING + NUMBER_SIZE;
          const y2 = LIST_TOP + (i + 1) * STEP_SPACING;
          return (
            <line
              key={i}
              x1={LINE_X}
              y1={y1}
              x2={LINE_X}
              y2={y1 + (y2 - y1) * lineProgress}
              stroke={VOX_COLORS.lightGray}
              strokeWidth={s(2)}
              opacity={combinedOpacity}
              strokeDasharray={`${s(6)} ${s(4)}`}
            />
          );
        })}
      </svg>

      {/* Steps */}
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const stepTop = LIST_TOP + i * STEP_SPACING;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: stepTop,
              left: 0,
              right: s(60),
              opacity: itemOpacities[i] * combinedOpacity,
            }}
          >
            {/* Step number circle */}
            <div style={{
              position: 'absolute',
              left: s(60),
              top: 0,
              width: NUMBER_SIZE,
              height: NUMBER_SIZE,
              borderRadius: '50%',
              backgroundColor: isLast ? VOX_COLORS.highlight : VOX_COLORS.charcoal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'Inter',
                fontSize: s(VOX_SIZES.label),
                fontWeight: 700,
                color: isLast ? VOX_COLORS.charcoal : VOX_COLORS.offWhite,
              }}>
                {i + 1}
              </span>
            </div>

            {/* Step content */}
            <div style={{
              marginLeft: CONTENT_LEFT,
              paddingTop: s(4),
            }}>
              <VoxLabel text={step.label} color={VOX_COLORS.charcoal} />
              {step.description && (
                <div style={{ marginTop: s(8) }}>
                  <VoxBody text={step.description} size={s(VOX_SIZES.body)} color={VOX_COLORS.darkGray} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      <FilmGrain opacity={0.25} />
    </AbsoluteFill>
  );
};

export default VoxProcess;
