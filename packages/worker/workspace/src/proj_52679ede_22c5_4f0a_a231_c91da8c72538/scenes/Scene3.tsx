import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRING_CONFIG } from '../constants';
import { WarningIcon, GearIcon } from '../components/Icons';

interface Scene3Props {
  startFrame?: number;
}

// Stressed heap node with shake effect
const StressedHeapNode: React.FC<{
  x: number;
  y: number;
  size: number;
  value: number;
  stressLevel: number;
}> = ({ x, y, size, value, stressLevel }) => {
  const frame = useCurrentFrame();

  // Shake effect based on stress
  const shakeX = stressLevel > 0.3
    ? interpolate((frame * 3) % 8, [0, 2, 4, 6, 8], [-3, 3, -2, 2, -3]) * stressLevel
    : 0;
  const shakeY = stressLevel > 0.3
    ? interpolate((frame * 3 + 2) % 8, [0, 2, 4, 6, 8], [-2, 2, -3, 3, -2]) * stressLevel
    : 0;

  // Color transition from purple to red based on stress
  const nodeColor = stressLevel > 0.5 ? COLORS.accent : COLORS.secondary;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2 + shakeX,
        top: y - size / 2 + shakeY,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${nodeColor}, ${COLORS.accent}88)`,
        border: `2px solid ${nodeColor}`,
        boxShadow: stressLevel > 0.5
          ? `0 0 ${20 + stressLevel * 20}px ${COLORS.accent}aa`
          : `0 0 10px ${COLORS.secondary}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: COLORS.white,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {value}
    </div>
  );
};

// Grinding gear with vibration
const GrindingGear: React.FC<{
  x: number;
  y: number;
  size: number;
  speed: number;
  stressLevel: number;
}> = ({ x, y, size, speed, stressLevel }) => {
  const frame = useCurrentFrame();

  // Stuttering rotation when stressed
  const baseRotation = frame * speed;
  const stutter = stressLevel > 0.5
    ? interpolate((frame * 2) % 10, [0, 3, 5, 7, 10], [0, -5, 0, 5, 0])
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `rotate(${baseRotation + stutter}deg)`,
        opacity: 0.4 + stressLevel * 0.3,
      }}
    >
      <GearIcon size={size} color={stressLevel > 0.5 ? COLORS.accent : COLORS.secondary} />
    </div>
  );
};

// Warning indicator
const WarningIndicator: React.FC<{
  x: number;
  y: number;
  delay: number;
}> = ({ x, y, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRING_CONFIG, stiffness: 150 },
  });

  const pulse = interpolate(
    (frame - delay) % 20,
    [0, 10, 20],
    [1, 1.2, 1],
    { extrapolateRight: 'clamp' }
  );

  if (appear <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${appear * pulse})`,
        filter: `drop-shadow(0 0 10px ${COLORS.accent})`,
      }}
    >
      <WarningIcon size={50} color={COLORS.accent} />
    </div>
  );
};

// Performance graph showing bottleneck
const PerformanceGraph: React.FC<{ stressLevel: number }> = ({ stressLevel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const graphAppear = spring({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIG,
  });

  // Animated line path
  const lineProgress = interpolate(frame, [30, 200], [0, 1], { extrapolateRight: 'clamp' });

  const graphWidth = 600;
  const graphHeight = 200;

  // Generate logarithmic curve points
  const points: string[] = [];
  for (let i = 0; i <= 50; i++) {
    const x = (i / 50) * graphWidth;
    const normalizedX = i / 50;
    // Logarithmic growth that becomes steep
    const y = graphHeight - (Math.log(normalizedX * 10 + 1) / Math.log(11)) * graphHeight * 0.85 * Math.min(1, lineProgress * 2);
    if (i <= lineProgress * 50) {
      points.push(`${x},${y}`);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12%',
        left: '50%',
        transform: `translateX(-50%) scale(${graphAppear})`,
        width: graphWidth + 100,
        height: graphHeight + 80,
        background: `${COLORS.dark}dd`,
        border: `2px solid ${COLORS.accent}44`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      {/* Graph title */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.accent,
          fontFamily: 'system-ui, sans-serif',
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Time Complexity: O(log n) per operation
      </div>

      <svg width={graphWidth + 60} height={graphHeight + 20} style={{ marginLeft: 20 }}>
        {/* Axes */}
        <line x1={30} y1={graphHeight} x2={graphWidth + 30} y2={graphHeight} stroke={COLORS.gray} strokeWidth={2} />
        <line x1={30} y1={0} x2={30} y2={graphHeight} stroke={COLORS.gray} strokeWidth={2} />

        {/* Axis labels */}
        <text x={graphWidth / 2 + 30} y={graphHeight + 18} fill={COLORS.gray} fontSize={14} textAnchor="middle">
          Number of Tasks
        </text>
        <text x={10} y={graphHeight / 2} fill={COLORS.gray} fontSize={14} textAnchor="middle" transform={`rotate(-90, 10, ${graphHeight / 2})`}>
          Time
        </text>

        {/* The curve */}
        {points.length > 1 && (
          <polyline
            points={points.map(p => {
              const [px, py] = p.split(',').map(Number);
              return `${px + 30},${py}`;
            }).join(' ')}
            fill="none"
            stroke={COLORS.accent}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Danger zone indicator */}
        {lineProgress > 0.7 && (
          <rect
            x={graphWidth * 0.7 + 30}
            y={0}
            width={graphWidth * 0.3}
            height={graphHeight}
            fill={`${COLORS.accent}22`}
            opacity={stressLevel}
          />
        )}
      </svg>
    </div>
  );
};

// Backed up task orbs showing bottleneck
const BottleneckOrbs: React.FC<{ stressLevel: number }> = ({ stressLevel }) => {
  const frame = useCurrentFrame();

  const orbCount = Math.floor(interpolate(frame, [0, 200], [0, 20], { extrapolateRight: 'clamp' }));

  return (
    <>
      {Array.from({ length: orbCount }).map((_, i) => {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const baseX = 440 + col * 45;
        const baseY = 700 + row * 40;

        // Jitter when stressed
        const jitterX = stressLevel > 0.5
          ? interpolate((frame + i * 7) % 6, [0, 3, 6], [-3, 3, -3])
          : 0;
        const jitterY = stressLevel > 0.5
          ? interpolate((frame + i * 5) % 6, [0, 3, 6], [-2, 2, -2])
          : 0;

        return (
          <div
            key={`bottleneck-${i}`}
            style={{
              position: 'absolute',
              left: baseX + jitterX,
              top: baseY + jitterY,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${COLORS.primary}, ${COLORS.accent}88)`,
              boxShadow: `0 0 12px ${COLORS.primary}66`,
              opacity: 0.8,
            }}
          />
        );
      })}
    </>
  );
};

export const Scene3: React.FC<Scene3Props> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Stress level increases over time
  const stressLevel = interpolate(frame, [0, 400], [0.2, 1], { extrapolateRight: 'clamp' });

  // Red flash at key sync (frame 9 relative)
  const flashOpacity = interpolate(
    frame,
    [6, 9, 15, 25],
    [0, 0.4, 0.2, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Screen shake at key sync
  const screenShake = frame < 30
    ? interpolate(frame, [6, 9, 20, 30], [0, 1, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const shakeX = screenShake * interpolate((frame * 4) % 8, [0, 4, 8], [-8, 8, -8]);
  const shakeY = screenShake * interpolate((frame * 4 + 2) % 8, [0, 4, 8], [-5, 5, -5]);

  // Heap node positions
  const heapValues = [1, 3, 2, 7, 6, 4, 5, 15, 12, 9];
  const nodeSize = 55;
  const centerX = width / 2;
  const startY = 180;
  const levelHeight = 100;

  const getNodePosition = (index: number) => {
    const level = Math.floor(Math.log2(index + 1));
    const levelStart = Math.pow(2, level) - 1;
    const positionInLevel = index - levelStart;
    const nodesInLevel = Math.pow(2, level);
    const levelWidth = width * 0.65;
    const spacing = levelWidth / nodesInLevel;
    const x = centerX - levelWidth / 2 + spacing * (positionInLevel + 0.5);
    const y = startY + level * levelHeight;
    return { x, y };
  };

  return (
    <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>
      {/* Red flash overlay */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: COLORS.accent,
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 42,
          fontWeight: 800,
          color: COLORS.accent,
          fontFamily: 'system-ui, sans-serif',
          textShadow: `0 0 20px ${COLORS.accent}88`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        THE BOTTLENECK
      </div>

      {/* Grinding gears in background */}
      <GrindingGear x={100} y={300} size={100} speed={0.8} stressLevel={stressLevel} />
      <GrindingGear x={880} y={250} size={80} speed={-0.6} stressLevel={stressLevel} />
      <GrindingGear x={150} y={600} size={70} speed={0.5} stressLevel={stressLevel} />
      <GrindingGear x={850} y={550} size={90} speed={-0.7} stressLevel={stressLevel} />

      {/* Warning indicators */}
      <WarningIndicator x={300} y={200} delay={15} />
      <WarningIndicator x={700} y={180} delay={25} />
      <WarningIndicator x={200} y={450} delay={35} />
      <WarningIndicator x={820} y={400} delay={45} />

      {/* Stressed heap connections */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {heapValues.slice(0, -1).map((_, i) => {
          const leftChild = 2 * i + 1;
          const rightChild = 2 * i + 2;
          const parent = getNodePosition(i);

          return (
            <g key={`conn-${i}`}>
              {leftChild < heapValues.length && (
                <line
                  x1={parent.x}
                  y1={parent.y + nodeSize / 2}
                  x2={getNodePosition(leftChild).x}
                  y2={getNodePosition(leftChild).y - nodeSize / 2}
                  stroke={stressLevel > 0.6 ? COLORS.accent : COLORS.secondary}
                  strokeWidth={3}
                  opacity={0.6}
                />
              )}
              {rightChild < heapValues.length && (
                <line
                  x1={parent.x}
                  y1={parent.y + nodeSize / 2}
                  x2={getNodePosition(rightChild).x}
                  y2={getNodePosition(rightChild).y - nodeSize / 2}
                  stroke={stressLevel > 0.6 ? COLORS.accent : COLORS.secondary}
                  strokeWidth={3}
                  opacity={0.6}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Stressed heap nodes */}
      {heapValues.map((value, i) => {
        const pos = getNodePosition(i);
        return (
          <StressedHeapNode
            key={`stressed-node-${i}`}
            x={pos.x}
            y={pos.y}
            size={nodeSize}
            value={value}
            stressLevel={stressLevel}
          />
        );
      })}

      {/* Bottleneck orbs */}
      <BottleneckOrbs stressLevel={stressLevel} />

      {/* Performance graph */}
      <PerformanceGraph stressLevel={stressLevel} />
    </AbsoluteFill>
  );
};

export default Scene3;
