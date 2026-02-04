import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

type AnimationType = 'fade' | 'scale' | 'slideUp' | 'slideRight' | 'slideDown';

interface StaggerProps {
  /** Frame when first child starts animating */
  startFrame: number;
  /** Delay between each child in frames (default: 8) */
  delayFrames?: number;
  /** Animation type (default: 'scale') */
  animationType?: AnimationType;
  /** Spring damping (default: 12) */
  damping?: number;
  /** Spring stiffness (default: 80) */
  stiffness?: number;
  /** Children to stagger */
  children: React.ReactNode;
}

/**
 * Stagger - Staggered entrance for list items
 *
 * Use for: list animations, multiple items entering, step-by-step reveals
 *
 * @example
 * <Stagger startFrame={30} delayFrames={10}>
 *   {items.map((item, i) => <Item key={i} data={item} />)}
 * </Stagger>
 */
export const Stagger: React.FC<StaggerProps> = ({
  startFrame,
  delayFrames = 8,
  animationType = 'scale',
  damping = 12,
  stiffness = 80,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const childArray = React.Children.toArray(children);

  return (
    <>
      {childArray.map((child, index) => {
        const childStartFrame = startFrame + index * delayFrames;
        const localFrame = Math.max(0, frame - childStartFrame);

        const springValue = spring({
          frame: localFrame,
          fps,
          config: { damping, stiffness },
        });

        const isVisible = frame >= childStartFrame;

        let style: React.CSSProperties = {};

        switch (animationType) {
          case 'fade':
            style = {
              opacity: isVisible ? springValue : 0,
            };
            break;

          case 'scale':
            style = {
              opacity: isVisible ? 1 : 0,
              transform: `scale(${isVisible ? springValue : 0})`,
              transformOrigin: 'center center',
            };
            break;

          case 'slideUp':
            const slideUpY = interpolate(springValue, [0, 1], [height * 0.05, 0]);
            style = {
              opacity: isVisible ? springValue : 0,
              transform: `translateY(${isVisible ? slideUpY : height * 0.05}px)`,
            };
            break;

          case 'slideRight':
            const slideRightX = interpolate(springValue, [0, 1], [-50, 0]);
            style = {
              opacity: isVisible ? springValue : 0,
              transform: `translateX(${isVisible ? slideRightX : -50}px)`,
            };
            break;

          case 'slideDown':
            const slideDownY = interpolate(springValue, [0, 1], [-height * 0.05, 0]);
            style = {
              opacity: isVisible ? springValue : 0,
              transform: `translateY(${isVisible ? slideDownY : -height * 0.05}px)`,
            };
            break;
        }

        return (
          <div key={index} style={style}>
            {child}
          </div>
        );
      })}
    </>
  );
};

export default Stagger;
