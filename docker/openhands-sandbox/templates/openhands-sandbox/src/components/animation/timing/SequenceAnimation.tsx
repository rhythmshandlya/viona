import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface AnimationStep {
  /** Duration of this step in frames */
  durationFrames: number;
  /** Render function that receives progress (0-1) */
  render: (progress: number) => React.ReactNode;
}

interface SequenceAnimationProps {
  /** Array of animation steps */
  steps: AnimationStep[];
  /** Frame when sequence starts */
  startFrame: number;
}

/**
 * SequenceAnimation - Sequential animations that play one after another
 *
 * Use for: step sequences, chained animations, timeline control
 *
 * @example
 * <SequenceAnimation
 *   startFrame={0}
 *   steps={[
 *     { durationFrames: 30, render: (p) => <FadeIn progress={p} /> },
 *     { durationFrames: 60, render: (p) => <MainAnimation progress={p} /> },
 *     { durationFrames: 30, render: (p) => <FadeOut progress={p} /> },
 *   ]}
 * />
 */
export const SequenceAnimation: React.FC<SequenceAnimationProps> = ({
  steps,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) {
    return null;
  }

  // Find which step we're in and calculate progress
  let accumulatedFrames = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepEndFrame = accumulatedFrames + step.durationFrames;

    if (localFrame < stepEndFrame) {
      const stepLocalFrame = localFrame - accumulatedFrames;
      const progress = interpolate(
        stepLocalFrame,
        [0, step.durationFrames],
        [0, 1],
        { extrapolateRight: 'clamp' }
      );

      return <>{step.render(progress)}</>;
    }

    accumulatedFrames = stepEndFrame;
  }

  // Past all steps - render last step at 100%
  if (steps.length > 0) {
    return <>{steps[steps.length - 1].render(1)}</>;
  }

  return null;
};

export default SequenceAnimation;
