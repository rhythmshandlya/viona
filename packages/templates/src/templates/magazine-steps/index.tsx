import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineStepsProps } from './schema';
import { paperSlide } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline } from '../../magazine/typography';
import { TapeMark } from '../../magazine/decorations';
import { StepCircle } from './components/StepCircle';
import { DashedLine } from './components/DashedLine';

const CANVAS_W = 1080;
const TITLE_Y = 120;
const TITLE_W = 800;
const TITLE_H = 140;
const FIRST_STEP_Y = 360;
const STEP_SPACING = 280;
const STAGGER = 12;

const MagazineSteps: React.FC<MagazineStepsProps> = ({ title, steps = [] }) => {
  const frame = useCurrentFrame();

  const titleSlide = paperSlide(frame, 0, 15, 'down');

  const lineStartY = FIRST_STEP_Y + 28;
  const lineEndY = FIRST_STEP_Y + (steps.length - 1) * STEP_SPACING + 28;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: (CANVAS_W - TITLE_W) / 2 + titleSlide.translateX,
        top: TITLE_Y + titleSlide.translateY,
        opacity: titleSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <div style={{ position: 'relative' }}>
          <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={210} width={TITLE_W} height={TITLE_H}>
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              <PaperTexture age={0.15} seed="steps-title" />
              <div style={{
                position: 'relative', zIndex: 1, width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24, boxSizing: 'border-box',
              }}>
                <SerifHeadline text={title} size={39} />
              </div>
            </div>
          </TornEdge>
          <TapeMark corner="top-left" seed={210} />
        </div>
      </div>

      <DashedLine startY={lineStartY} endY={lineEndY} />

      {steps.map((step, i) => {
        const revealFrame = 20 + i * STAGGER;
        const y = FIRST_STEP_Y + i * STEP_SPACING;

        return (
          <div key={i} style={{
            position: 'absolute', left: 100, top: y,
            width: CANVAS_W - 200,
          }}>
            <StepCircle
              stepNumber={i + 1}
              label={step.label}
              description={step.description}
              revealFrame={revealFrame}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default MagazineSteps;
