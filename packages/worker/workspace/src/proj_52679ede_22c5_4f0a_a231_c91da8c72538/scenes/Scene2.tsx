import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';

interface Scene2Props {
  startFrame?: number;
}

// Task orb flowing down
const TaskOrb: React.FC<{
  index: number;
  panelHeight: number;
  panelWidth: number;
}> = ({ index, panelHeight, panelWidth }) => {
  const frame = useCurrentFrame();

  const speed = 2 + (index % 3);
  const startY = -50 - (index * 40) % 200;
  const y = startY + frame * speed;
  const wrappedY = ((y % (panelHeight + 100)) + panelHeight + 100) % (panelHeight + 100) - 50;

  const x = 60 + (index * 47) % (panelWidth - 120);
  const xWobble = interpolate(
    (frame + index * 15) % 40,
    [0, 20, 40],
    [-8, 8, -8],
    { extrapolateRight: 'clamp' }
  );

  const size = 14 + (index % 4) * 4;
  const opacity = interpolate(
    wrappedY,
    [0, 100, panelHeight - 100, panelHeight],
    [0, 0.9, 0.9, 0.3],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x + xWobble,
        top: wrappedY,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.secondary})`,
        boxShadow: `0 0 ${size}px ${COLORS.primary}88`,
        opacity,
      }}
    />
  );
};

// Binary heap node
const HeapNode: React.FC<{
  x: number;
  y: number;
  size: number;
  delay: number;
  value: number;
  isPulsing?: boolean;
}> = ({ x, y, size, delay, value, isPulsing = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIG,
  });

  const pulseScale = isPulsing
    ? interpolate((frame - delay) % 30, [0, 15, 30], [1, 1.15, 1], { extrapolateRight: 'clamp' })
    : 1;

  const scale = Math.max(0, scaleProgress) * pulseScale;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${COLORS.secondary}, ${COLORS.accent}88)`,
        border: `2px solid ${COLORS.secondary}`,
        boxShadow: isPulsing
          ? `0 0 20px ${COLORS.accent}88`
          : `0 0 10px ${COLORS.secondary}66`,
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: COLORS.white,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {value}
    </div>
  );
};

// Connection line between heap nodes
const HeapConnection: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}> = ({ x1, y1, x2, y2, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, damping: 30 },
  });

  const opacity = Math.max(0, progress);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x1 + (x2 - x1) * progress}
      y2={y1 + (y2 - y1) * progress}
      stroke={COLORS.secondary}
      strokeWidth={3}
      opacity={opacity * 0.7}
    />
  );
};

// Binary heap tree visualization
const BinaryHeapTree: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();

  // Heap values (simulating a min-heap with task priorities)
  const heapValues = [1, 3, 2, 7, 6, 4, 5, 15, 12, 9, 8];

  // Calculate node positions for binary tree layout
  const nodeSize = 50;
  const levelHeight = 90;
  const centerX = width / 2;
  const startY = 80;

  const getNodePosition = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = Math.pow(2, level) - 1;
    const positionInLevel = index - levelStart;
    const nodesInLevel = Math.pow(2, level);
    const levelWidth = width * 0.85;
    const spacing = levelWidth / nodesInLevel;
    const x = centerX - levelWidth / 2 + spacing * (positionInLevel + 0.5);
    const y = startY + level * levelHeight;
    return { x, y };
  };

  // Which nodes are currently "sorting" (pulsing)
  const pulsingNode = Math.floor((frame / 20) % heapValues.length);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Connections */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
      >
        {heapValues.slice(0, -1).map((_, i) => {
          const leftChild = 2 * i + 1;
          const rightChild = 2 * i + 2;
          const parent = getNodePosition(i);

          return (
            <g key={`conn-${i}`}>
              {leftChild < heapValues.length && (
                <HeapConnection
                  x1={parent.x}
                  y1={parent.y + nodeSize / 2}
                  x2={getNodePosition(leftChild).x}
                  y2={getNodePosition(leftChild).y - nodeSize / 2}
                  delay={i * 8 + 20}
                />
              )}
              {rightChild < heapValues.length && (
                <HeapConnection
                  x1={parent.x}
                  y1={parent.y + nodeSize / 2}
                  x2={getNodePosition(rightChild).x}
                  y2={getNodePosition(rightChild).y - nodeSize / 2}
                  delay={i * 8 + 24}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {heapValues.map((value, i) => {
        const pos = getNodePosition(i);
        return (
          <HeapNode
            key={`node-${i}`}
            x={pos.x}
            y={pos.y}
            size={nodeSize}
            delay={i * 8}
            value={value}
            isPulsing={i === pulsingNode && frame > 60}
          />
        );
      })}

      {/* O(log n) label */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: `${COLORS.dark}cc`,
          border: `2px solid ${COLORS.accent}`,
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: COLORS.accent,
        }}
      >
        O(log n) per insert
      </div>
    </div>
  );
};

// Task counter component
const TaskCounter: React.FC = () => {
  const frame = useCurrentFrame();

  const count = Math.round(
    interpolate(frame, [0, 300], [0, 1000000], { extrapolateRight: 'clamp' })
  );

  const formattedCount = count.toLocaleString();

  return (
    <div
      style={{
        position: 'absolute',
        top: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '16px 40px',
        background: `linear-gradient(135deg, ${COLORS.dark}ee, ${COLORS.secondary}22)`,
        border: `2px solid ${COLORS.primary}`,
        borderRadius: 16,
        fontSize: 36,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        color: COLORS.white,
        textAlign: 'center',
        boxShadow: `0 0 20px ${COLORS.primary}44`,
      }}
    >
      <span style={{ color: COLORS.gray, fontSize: 24 }}>TASKS: </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: COLORS.primary }}>
        {formattedCount}
      </span>
    </div>
  );
};

export const Scene2: React.FC<Scene2Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Split screen animation
  const splitProgress = spring({
    frame,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 60 },
  });

  const panelWidth = width * 0.45;
  const panelHeight = height * 0.65;

  return (
    <AbsoluteFill>
      {/* Task counter */}
      <TaskCounter />

      {/* Left panel - Task orbs */}
      <div
        style={{
          position: 'absolute',
          left: `${2.5 + (1 - splitProgress) * 50}%`,
          top: '18%',
          width: panelWidth,
          height: panelHeight,
          overflow: 'hidden',
          borderRadius: 20,
          background: `${COLORS.dark}88`,
          border: `1px solid ${COLORS.primary}44`,
          opacity: splitProgress,
        }}
      >
        {/* Panel label */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.primary,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Incoming Tasks
        </div>

        {/* Flowing orbs */}
        {Array.from({ length: 25 }).map((_, i) => (
          <TaskOrb
            key={`orb-${i}`}
            index={i}
            panelHeight={panelHeight}
            panelWidth={panelWidth}
          />
        ))}
      </div>

      {/* Separator line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '15%',
          width: 2,
          height: '70%',
          background: `linear-gradient(to bottom, transparent, ${COLORS.primary}88, ${COLORS.primary}88, transparent)`,
          transform: `scaleY(${splitProgress})`,
          transformOrigin: 'top',
        }}
      />

      {/* Right panel - Binary heap */}
      <div
        style={{
          position: 'absolute',
          right: `${2.5 + (1 - splitProgress) * 50}%`,
          top: '18%',
          width: panelWidth,
          height: panelHeight,
          overflow: 'hidden',
          borderRadius: 20,
          background: `${COLORS.dark}88`,
          border: `1px solid ${COLORS.secondary}44`,
          opacity: splitProgress,
        }}
      >
        {/* Panel label */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.secondary,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Priority Queue (Binary Heap)
        </div>

        <BinaryHeapTree width={panelWidth} height={panelHeight} />
      </div>

      {/* Bottom explanation text */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 26,
          fontWeight: 500,
          color: COLORS.gray,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        The intuitive solution: sort tasks by expiration time
      </div>
    </AbsoluteFill>
  );
};

export default Scene2;
