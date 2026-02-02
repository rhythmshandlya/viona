import React from 'react';
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';

type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'wipe' | 'flip';
type TimingType = 'linear' | 'spring';

interface SceneConfig {
  /** Duration of this scene in frames */
  durationInFrames: number;
  /** Content to render */
  content: React.ReactNode;
}

interface SceneTransitionProps {
  /** Array of scenes with duration and content */
  scenes: SceneConfig[];
  /** Transition type between scenes */
  transition?: TransitionType;
  /** Transition duration in frames */
  transitionDuration?: number;
  /** Timing function for transitions */
  timing?: TimingType;
  /** Spring config (if timing is 'spring') */
  springConfig?: { damping?: number; stiffness?: number; mass?: number };
}

/**
 * SceneTransition - Easy scene transitions using @remotion/transitions
 *
 * Wraps multiple scenes with professional transitions between them.
 * Supports fade, slide, wipe, and flip transitions.
 *
 * @example
 * <SceneTransition
 *   transition="slide-left"
 *   transitionDuration={20}
 *   scenes={[
 *     { durationInFrames: 90, content: <Scene1 /> },
 *     { durationInFrames: 90, content: <Scene2 /> },
 *     { durationInFrames: 90, content: <Scene3 /> },
 *   ]}
 * />
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  scenes,
  transition = 'fade',
  transitionDuration = 15,
  timing = 'spring',
  springConfig = { damping: 200, stiffness: 100 },
}) => {
  // Get presentation based on transition type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPresentation = (): any => {
    switch (transition) {
      case 'fade':
        return fade();
      case 'slide-left':
        return slide({ direction: 'from-left' });
      case 'slide-right':
        return slide({ direction: 'from-right' });
      case 'slide-up':
        return slide({ direction: 'from-top' });
      case 'slide-down':
        return slide({ direction: 'from-bottom' });
      case 'wipe':
        return wipe({ direction: 'from-left' });
      case 'flip':
        return flip({ direction: 'from-left' });
      default:
        return fade();
    }
  };

  // Get timing based on type
  const getTiming = () => {
    if (timing === 'spring') {
      return springTiming({
        config: springConfig,
        durationInFrames: transitionDuration,
      });
    }
    return linearTiming({ durationInFrames: transitionDuration });
  };

  const presentation = getPresentation();
  const timingFn = getTiming();

  // Build the transition series
  const elements: React.ReactNode[] = [];

  scenes.forEach((scene, index) => {
    // Add the scene
    elements.push(
      <TransitionSeries.Sequence
        key={`scene-${index}`}
        durationInFrames={scene.durationInFrames}
      >
        {scene.content}
      </TransitionSeries.Sequence>
    );

    // Add transition between scenes (not after the last one)
    if (index < scenes.length - 1) {
      elements.push(
        <TransitionSeries.Transition
          key={`transition-${index}`}
          presentation={presentation}
          timing={timingFn}
        />
      );
    }
  });

  return <TransitionSeries>{elements}</TransitionSeries>;
};

export default SceneTransition;
