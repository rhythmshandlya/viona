import React from 'react';
import { VOX_COLORS } from './constants';
import { RoughEdgeMask } from './effects';

export const HighlighterStroke: React.FC<{
  width: number;
  thickness?: number;
  rotation?: number;
  color?: string;
}> = ({ width, thickness = 8, rotation = 0.8, color = VOX_COLORS.highlight }) => (
  <div style={{
    width,
    height: thickness,
    backgroundColor: color,
    opacity: 0.85,
    transform: `rotate(${rotation}deg)`,
    borderRadius: 1,
  }} />
);

export const AnnotationCircle: React.FC<{
  size: number;
  color?: string;
  strokeWidth?: number;
}> = ({ size, color = VOX_COLORS.highlight, strokeWidth = 3 }) => (
  <RoughEdgeMask seed={size * 3} scale={2}>
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${strokeWidth}px solid ${color}`,
      boxSizing: 'border-box' as const,
    }} />
  </RoughEdgeMask>
);

export const AnnotationArrow: React.FC<{
  length: number;
  angle?: number;
  color?: string;
  headSize?: number;
}> = ({ length, angle = 0, color = VOX_COLORS.highlight, headSize = 8 }) => (
  <RoughEdgeMask seed={length * 5} scale={1.5}>
    <div style={{ transform: `rotate(${angle}deg)`, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: length - headSize, height: 3, backgroundColor: color }} />
      <div style={{
        width: 0,
        height: 0,
        borderLeft: `${headSize}px solid ${color}`,
        borderTop: `${headSize / 2}px solid transparent`,
        borderBottom: `${headSize / 2}px solid transparent`,
      }} />
    </div>
  </RoughEdgeMask>
);

export const CutoutFrame: React.FC<{
  width: number;
  height: number;
  rotation?: number;
  seed?: number;
  children: React.ReactNode;
}> = ({ width, height, rotation = 0, seed = 99, children }) => (
  <RoughEdgeMask seed={seed} scale={4}>
    <div style={{
      width,
      height,
      overflow: 'hidden',
      transform: `rotate(${rotation}deg)`,
    }}>
      {children}
    </div>
  </RoughEdgeMask>
);

export const RoughDivider: React.FC<{
  length: number;
  direction?: 'horizontal' | 'vertical';
  color?: string;
  thickness?: number;
}> = ({ length, direction = 'horizontal', color = VOX_COLORS.lightGray, thickness = 2 }) => (
  <RoughEdgeMask seed={length * 11} scale={2}>
    <div style={{
      width: direction === 'horizontal' ? length : thickness,
      height: direction === 'vertical' ? length : thickness,
      backgroundColor: color,
    }} />
  </RoughEdgeMask>
);
