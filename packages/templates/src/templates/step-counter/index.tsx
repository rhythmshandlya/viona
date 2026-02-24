import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { getConstants, BACKGROUNDS } from './constants';
import { useScale } from '../../use-scale';
import type { StepCounterProps } from './schema';

/* ------------------------------------------------------------------ */
/*  DotGrid SVG background                                            */
/* ------------------------------------------------------------------ */
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern
          id="step-dot-grid"
          width={s(32)}
          height={s(32)}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#step-dot-grid)" />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  SVG arc helper (same approach as stat-progress)                   */
/* ------------------------------------------------------------------ */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  const start = {
    x: cx + r * Math.cos(endRad),
    y: cy + r * Math.sin(endRad),
  };
  const end = {
    x: cx + r * Math.cos(startRad),
    y: cy + r * Math.sin(startRad),
  };
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/* ------------------------------------------------------------------ */
/*  Progress Ring with centered step number                           */
/* ------------------------------------------------------------------ */
const ProgressRing: React.FC<{
  stepNumber: number;
  totalSteps: number;
  progress: number; // 0-1, how full the ring should be for current completion
  accentColor: string;
  trackColor: string;
  textColor: string;
  headlineFont: string;
}> = ({
  stepNumber,
  totalSteps,
  progress,
  accentColor,
  trackColor,
  textColor,
  headlineFont,
}) => {
  const s = useScale();
  const RING_SIZE = s(320);
  const RING_RADIUS = s(130);
  const RING_STROKE = s(14);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const sweepAngle = progress * 360;

  return (
    <div
      style={{
        position: 'relative',
        width: RING_SIZE,
        height: RING_SIZE,
      }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={RING_STROKE}
        />
        {/* Animated progress arc */}
        {sweepAngle > 0.5 && (
          <path
            d={describeArc(cx, cy, RING_RADIUS, 0, Math.min(sweepAngle, 359.9))}
            fill="none"
            stroke={accentColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            filter={`drop-shadow(0 0 10px ${accentColor}60)`}
          />
        )}
      </svg>
      {/* Centered step number */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: headlineFont,
            fontSize: s(96),
            fontWeight: 800,
            color: textColor,
            lineHeight: 1,
          }}
        >
          {stepNumber}
        </span>
        <span
          style={{
            fontFamily: headlineFont,
            fontSize: s(22),
            fontWeight: 500,
            color: `${textColor}80`,
            marginTop: s(4),
          }}
        >
          of {totalSteps}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Dot indicators at bottom                                          */
/* ------------------------------------------------------------------ */
const StepDots: React.FC<{
  totalSteps: number;
  currentStep: number; // 0-indexed
  accentColor: string;
  inactiveColor: string;
  completedColor: string;
}> = ({ totalSteps, currentStep, accentColor, inactiveColor, completedColor }) => {
  const s = useScale();
  const DOT_SIZE = s(16);
  const DOT_GAP = s(20);
  return (
    <div
      style={{
        display: 'flex',
        gap: DOT_GAP,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: totalSteps }).map((_, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;

        return (
          <div
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              backgroundColor: isCurrent
                ? accentColor
                : isCompleted
                  ? completedColor
                  : 'transparent',
              border: `2px solid ${
                isCurrent
                  ? accentColor
                  : isCompleted
                    ? completedColor
                    : inactiveColor
              }`,
              boxShadow: isCurrent ? `0 0 ${s(12)}px ${accentColor}80` : 'none',
              transition: 'all 0.2s ease',
            }}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
const StepCounter: React.FC<StepCounterProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const steps = props.steps;
  const totalSteps = steps.length;

  // --- Timeline calculations ---
  // 0-15: background fade in
  // 20-310: steps cycle through (evenly distributed)
  // 330-360: fade out
  const STEPS_START = 20;
  const STEPS_END = 310;
  const STEP_DURATION = (STEPS_END - STEPS_START) / totalSteps;

  // Determine current step index (0-indexed)
  const rawStepIndex = Math.floor(
    (frame - STEPS_START) / STEP_DURATION,
  );
  const currentStepIndex = Math.max(
    0,
    Math.min(totalSteps - 1, rawStepIndex),
  );

  // Progress within the current step (0 to 1)
  const stepLocalFrame = frame - (STEPS_START + currentStepIndex * STEP_DURATION);
  const stepLocalProgress = Math.max(
    0,
    Math.min(1, stepLocalFrame / STEP_DURATION),
  );

  // Overall completion percentage for the ring
  // At beginning of step i the ring shows i/totalSteps,
  // and it animates to (i+1)/totalSteps during the step
  const completionBase = currentStepIndex / totalSteps;
  const ringAnimatedProgress = interpolate(
    stepLocalProgress,
    [0, 0.7],
    [completionBase, completionBase + 1 / totalSteps],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // Clamp final ring value
  const ringProgress = Math.min(1, ringAnimatedProgress);

  // --- Fade transitions ---
  // Background fade in: 0-15
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Fade out: 330-360
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  // Title/description fade transition on each step change
  const stepTransitionIn = interpolate(
    stepLocalFrame,
    [0, 12],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const stepTransitionSlideY = interpolate(
    stepLocalFrame,
    [0, 12],
    [18, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    },
  );

  // Label area entrance
  const labelOpacity = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "Step X of Y" header
  const headerOpacity = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headerSlideY = interpolate(frame, [8, 20], [-12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Ring entrance
  const ringEntrance = interpolate(frame, [10, 24], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const ringEntranceOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dots entrance
  const dotsOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dotsSlideY = interpolate(frame, [18, 30], [16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: introOpacity * outroOpacity,
        overflow: 'hidden',
      }}
    >
      <DotGrid color={theme.gridColor} />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: s(60),
        }}
      >
        {/* "STEP X OF Y" header text */}
        <div
          style={{
            opacity: headerOpacity,
            transform: `translateY(${headerSlideY}px)`,
            marginBottom: s(32),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: s(24),
              fontWeight: 600,
              letterSpacing: s(6),
              color: theme.textMuted,
              textTransform: 'uppercase',
            }}
          >
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
        </div>

        {/* Progress Ring with step number */}
        <div
          style={{
            opacity: ringEntranceOpacity,
            transform: `scale(${ringEntrance})`,
            marginBottom: s(40),
          }}
        >
          <ProgressRing
            stepNumber={currentStepIndex + 1}
            totalSteps={totalSteps}
            progress={ringProgress}
            accentColor={props.accentColor}
            trackColor={theme.ringTrack}
            textColor={theme.text}
            headlineFont={FONTS.headline}
          />
        </div>

        {/* Step title / description */}
        <div
          style={{
            opacity: labelOpacity * stepTransitionIn,
            transform: `translateY(${stepTransitionSlideY}px)`,
            textAlign: 'center',
            maxWidth: s(700),
            marginBottom: s(56),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.headline,
              fontSize: s(44),
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.3,
            }}
          >
            {steps[currentStepIndex]}
          </span>
        </div>

        {/* Progress dots at bottom */}
        <div
          style={{
            opacity: dotsOpacity,
            transform: `translateY(${dotsSlideY}px)`,
          }}
        >
          <StepDots
            totalSteps={totalSteps}
            currentStep={currentStepIndex}
            accentColor={props.accentColor}
            inactiveColor={theme.dotInactive}
            completedColor={theme.dotCompleted}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default StepCounter;
