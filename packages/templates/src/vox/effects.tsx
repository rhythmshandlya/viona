import React from 'react';
import { useCurrentFrame } from 'remotion';
import { VOX_GRAIN, VOX_ROUGH } from './constants';

/**
 * Cycling film grain overlay — shifts pattern every N frames.
 * Must be placed as last child (on top) of the scene.
 */
export const FilmGrain: React.FC<{
  opacity?: number;
  cycleFrames?: number;
  seed?: number;
}> = ({ opacity = VOX_GRAIN.opacity, cycleFrames = VOX_GRAIN.cycleFrames, seed = 1 }) => {
  const frame = useCurrentFrame();
  const cycleSeed = seed + Math.floor(frame / cycleFrames);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%" style={{ opacity }}>
        <filter id={`vox-grain-${cycleSeed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed={cycleSeed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#vox-grain-${cycleSeed})`} />
      </svg>
    </div>
  );
};

/**
 * Rough edge mask — wraps children in a jagged container via SVG displacement.
 */
export const RoughEdgeMask: React.FC<{
  frequency?: number;
  scale?: number;
  seed?: number;
  children: React.ReactNode;
}> = ({
  frequency = VOX_ROUGH.turbulenceFrequency,
  scale = VOX_ROUGH.displacementScale,
  seed = 42,
  children,
}) => {
  const filterId = `vox-rough-${seed}`;
  return (
    <div style={{ position: 'relative' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={filterId}>
          <feTurbulence type="turbulence" baseFrequency={frequency} numOctaves="2" seed={seed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div style={{ filter: `url(#${filterId})` }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Animated yellow highlighter mark behind text.
 */
export const HighlighterMark: React.FC<{
  widthPercent: number;
  height: number;
  rotation?: number;
  yOffset?: number;
  color?: string;
  opacity?: number;
}> = ({
  widthPercent,
  height,
  rotation = 0.8,
  yOffset = -1,
  color = '#FFEB00',
  opacity = 0.85,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: yOffset,
      width: `${widthPercent}%`,
      height,
      backgroundColor: color,
      opacity,
      transform: `rotate(${rotation}deg)`,
      zIndex: -1,
    }}
  />
);

/**
 * Chromatic aberration — wraps children with RGB channel offset.
 */
export const ChromaticAberration: React.FC<{
  offset?: number;
  children: React.ReactNode;
}> = ({ offset = 1.5, children }) => (
  <div style={{ position: 'relative' }}>
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="vox-red">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id="vox-blue">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
      </defs>
    </svg>
    <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.3, transform: `translate(${offset}px, 0)`, filter: 'url(#vox-red)' }}>
      {children}
    </div>
    <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.3, transform: `translate(-${offset}px, 0)`, filter: 'url(#vox-blue)' }}>
      {children}
    </div>
    <div style={{ position: 'relative' }}>
      {children}
    </div>
  </div>
);

/**
 * Warm color temperature shift overlay.
 */
export const WarmShift: React.FC<{
  intensity?: number;
}> = ({ intensity = 0.04 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundColor: `rgba(255, 200, 100, ${intensity})`,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
    }}
  />
);
