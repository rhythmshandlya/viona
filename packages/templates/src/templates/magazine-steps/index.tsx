import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { MagazineStepsProps } from './schema';
import { editorialReveal } from '../../magazine/animations';
import { SerifHeadline } from '../../magazine/typography';
import { MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { StepCircle } from './components/StepCircle';
import { DashedLine } from './components/DashedLine';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const FIRST_STEP_Y = 340;
const STEP_SPACING = 220;
const STEP_LEFT = 80;
const CARD_W = 860;
const CIRCLE_CENTER_X = STEP_LEFT + 34; // center of 68px circle
const STAGGER = 10;

const MagazineSteps: React.FC<MagazineStepsProps> = ({ title, steps = [] }) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 3, 14);

  const lineStartY = FIRST_STEP_Y + 68; // bottom of first circle
  const lineEndY = FIRST_STEP_Y + (steps.length - 1) * STEP_SPACING + 34; // center of last circle

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Title */}
      <div style={{
        position: 'absolute', left: 0, top: 140, width: CANVAS_W,
        display: 'flex', justifyContent: 'center',
        opacity: titleReveal.opacity,
        transform: `translateY(${titleReveal.translateY}px)`,
      }}>
        <SerifHeadline text={title} size={FONT_SIZES.h1} />
      </div>

      {/* Accent rule under title */}
      <div style={{
        position: 'absolute', left: CANVAS_W / 2 - 40, top: 235,
        width: 80, height: 3, borderRadius: 1.5,
        backgroundColor: MAGAZINE_COLORS.accent,
        opacity: titleReveal.opacity,
      }} />

      {/* Dashed connecting line */}
      {steps.length > 1 && (
        <DashedLine startY={lineStartY} endY={lineEndY} x={CIRCLE_CENTER_X} />
      )}

      {/* Step cards */}
      {steps.map((step, i) => {
        const revealFrame = 15 + i * STAGGER;
        const y = FIRST_STEP_Y + i * STEP_SPACING;

        return (
          <div key={i} style={{
            position: 'absolute', left: STEP_LEFT, top: y,
            width: CANVAS_W - STEP_LEFT - 60,
          }}>
            <StepCircle
              stepNumber={i + 1}
              label={step.label}
              description={step.description}
              revealFrame={revealFrame}
              cardWidth={CARD_W}
            />
          </div>
        );
      })}
    </ScaledContainer>
  );
};

export default MagazineSteps;
