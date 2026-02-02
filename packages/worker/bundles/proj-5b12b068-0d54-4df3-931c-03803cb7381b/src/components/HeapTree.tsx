import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COLORS } from '../constants';

interface HeapNodeProps {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  parentX?: number;
  parentY?: number;
  startFrame: number;
  isStressed?: boolean;
}

const HeapNode: React.FC<HeapNodeProps> = ({
  x,
  y,
  size,
  parentX,
  parentY,
  label,
  startFrame,
  isStressed
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100 }
  });

  const shake = isStressed ? Math.sin(frame * 1.5) * 5 : 0;

  return (
    <g style={{ opacity: entrance, transform: `scale(${entrance})` }}>
      {parentX !== undefined && parentY !== undefined && (
        <line
          x1={parentX}
          y1={parentY}
          x2={x}
          y2={y}
          stroke={COLORS.muted}
          strokeWidth={4}
          strokeDasharray="8 8"
        />
      )}
      <circle
        cx={x + shake}
        cy={y + shake}
        r={size}
        fill={isStressed ? COLORS.danger : COLORS.primary}
        stroke={COLORS.white}
        strokeWidth={2}
      />
      <text
        x={x + shake}
        y={y + shake + 5}
        textAnchor="middle"
        fill={COLORS.white}
        fontSize={24}
        fontWeight="bold"
      >
        {label}
      </text>
    </g>
  );
};

export const HeapTree: React.FC<{
  startFrame: number;
  isStressed?: boolean;
}> = ({ startFrame, isStressed }) => {
  const nodes = [
    { id: '1', label: '10', x: 540, y: 200 },
    { id: '2', label: '15', x: 300, y: 400, pid: '1' },
    { id: '3', label: '20', x: 780, y: 400, pid: '1' },
    { id: '4', label: '25', x: 200, y: 600, pid: '2' },
    { id: '5', label: '30', x: 400, y: 600, pid: '2' },
    { id: '6', label: '35', x: 680, y: 600, pid: '3' },
    { id: '7', label: '40', x: 880, y: 600, pid: '3' },
  ];

  return (
    <svg width="1080" height="800" viewBox="0 0 1080 800">
      {nodes.map((n, i) => {
        const parent = nodes.find(p => p.id === n.pid);
        return (
          <HeapNode
            key={n.id}
            id={n.id}
            label={n.label}
            x={n.x}
            y={n.y}
            size={40}
            parentX={parent?.x}
            parentY={parent?.y}
            startFrame={startFrame + i * 5}
            isStressed={isStressed}
          />
        );
      })}
    </svg>
  );
};
