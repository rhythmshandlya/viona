import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerTreeProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

// ── Layout helpers ────────────────────────────────────────────────────────────

interface NodePosition {
  x: number;
  y: number;
  label: string;
  level: number;
  parentIndex?: number; // index into the flat list of level-1 nodes
}

interface Connection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  animStart: number;
  animDuration: number;
}

function buildLayout(
  props: ExplainerTreeProps,
  width: number,
  height: number,
  s: (px: number) => number,
) {
  const nodes: NodePosition[] = [];
  const connections: Connection[] = [];

  const yRoot = height * 0.25;
  const yChildren = height * 0.5;
  const yGrandchildren = height * 0.75;

  // Root
  nodes.push({ x: width / 2, y: yRoot, label: props.root, level: 0 });

  const childCount = (props.children ?? []).length;
  const childSpacing = width / (childCount + 1);

  // Level 1: children
  const childPositions: { x: number; y: number }[] = [];
  for (let i = 0; i < childCount; i++) {
    const cx = childSpacing * (i + 1);
    childPositions.push({ x: cx, y: yChildren });
    nodes.push({ x: cx, y: yChildren, label: (props.children ?? [])[i]?.label ?? '', level: 1 });

    // Connection: root -> child
    connections.push({
      x1: width / 2,
      y1: yRoot,
      x2: cx,
      y2: yChildren,
      animStart: 15 + i * 3,
      animDuration: 25,
    });
  }

  // Level 2: grandchildren
  for (let i = 0; i < childCount; i++) {
    const gc = (props.children ?? [])[i]?.children ?? [];
    if (gc.length === 0) continue;

    const parentX = childPositions[i].x;
    const gcSpacing = s(160);
    const totalGcWidth = (gc.length - 1) * gcSpacing;
    const gcStartX = parentX - totalGcWidth / 2;

    for (let j = 0; j < gc.length; j++) {
      const gx = gc.length === 1 ? parentX : gcStartX + j * gcSpacing;
      nodes.push({
        x: gx,
        y: yGrandchildren,
        label: gc[j],
        level: 2,
        parentIndex: i,
      });

      // Connection: child -> grandchild
      connections.push({
        x1: parentX,
        y1: yChildren,
        x2: gx,
        y2: yGrandchildren,
        animStart: 50 + i * 5 + j * 3,
        animDuration: 25,
      });
    }
  }

  return { nodes, connections };
}

// ── Growing Line Component ────────────────────────────────────────────────────

function GrowingLine({
  x1,
  y1,
  x2,
  y2,
  frame,
  animStart,
  animDuration,
  strokeWidth,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  animStart: number;
  animDuration: number;
  strokeWidth: number;
}) {
  const progress = interpolate(frame, [animStart, animStart + animDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={BLACKBOARD_COLORS.surfaceBorder}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={length}
      strokeDashoffset={length * (1 - progress)}
    />
  );
}

// ── Traveling Dot Component ───────────────────────────────────────────────────

function TravelingDot({
  x1,
  y1,
  x2,
  y2,
  frame,
  cycleStart,
  cycleDuration,
  dotRadius,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frame: number;
  cycleStart: number;
  cycleDuration: number;
  dotRadius: number;
}) {
  // Travel upward (from child to parent), so animate from (x2,y2) to (x1,y1)
  const t = interpolate(frame, [cycleStart, cycleStart + cycleDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const opacity = interpolate(t, [0, 0.1, 0.9, 1], [0, 0.7, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < cycleStart || frame > cycleStart + cycleDuration) return null;

  const cx = x2 + (x1 - x2) * t;
  const cy = y2 + (y1 - y2) * t;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={dotRadius}
      fill={BLACKBOARD_COLORS.primary}
      opacity={opacity}
    />
  );
}

// ── Tree Node Component ───────────────────────────────────────────────────────

function TreeNode({
  x,
  y,
  label,
  level,
  frame,
  scaleStart,
  s,
}: {
  x: number;
  y: number;
  label: string;
  level: number;
  frame: number;
  scaleStart: number;
  s: (px: number) => number;
}) {
  const nodeScale = interpolate(frame, [scaleStart, scaleStart + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5)),
  });

  const radius = level === 0 ? s(52) : level === 1 ? s(40) : s(32);
  const fontSize = level === 0 ? s(22) : level === 1 ? s(18) : s(15);
  const borderColor = level === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.surfaceBorder;
  const borderWidth = level === 0 ? s(3) : s(2);

  return (
    <div
      style={{
        position: 'absolute',
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        transform: `scale(${nodeScale})`,
        transformOrigin: 'center center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Circle */}
      <div
        style={{
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          backgroundColor: BLACKBOARD_COLORS.surface,
          border: `${borderWidth}px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize,
            fontWeight: 600,
            color: level === 0 ? BLACKBOARD_COLORS.primary : BLACKBOARD_COLORS.text,
            textAlign: 'center',
            lineHeight: 1.15,
            padding: `0 ${s(6)}px`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: radius * 2 - s(12),
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Main Template Component ───────────────────────────────────────────────────

const ExplainerTree: React.FC<ExplainerTreeProps> = (props) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const { nodes, connections } = buildLayout(props, width, height, s);

  // ── Title fade in (0-10) ──────────────────────────────────────────────────
  const titleOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit fade (135-150) ───────────────────────────────────────────────────
  const exit = glowExit(frame, durationInFrames - 15, 15);

  // ── Compute node scale-in start frames ────────────────────────────────────
  // Root: appears at frame 5
  // Children: appear as their line arrives (line animStart + animDuration - a few frames overlap)
  // Grandchildren: same logic
  function getNodeScaleStart(node: NodePosition, index: number): number {
    if (node.level === 0) return 5;

    // Find the connection that feeds this node by matching its endpoint
    for (let ci = 0; ci < connections.length; ci++) {
      const conn = connections[ci];
      // Match connection endpoint to node position
      if (Math.abs(conn.x2 - node.x) < 1 && Math.abs(conn.y2 - node.y) < 1) {
        // Node appears ~5 frames before line finishes (overlap for smoother feel)
        return conn.animStart + conn.animDuration - 5;
      }
    }

    // Fallback
    return node.level === 1 ? 35 + index * 5 : 70 + index * 3;
  }

  // ── Traveling dots: periodic pulses from frame 80-120 ─────────────────────
  const dots: { x1: number; y1: number; x2: number; y2: number; cycleStart: number }[] = [];
  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    // Stagger dot starts across connections
    const baseStart = 80 + ci * 5;
    // Each connection gets one traveling dot pulse
    if (baseStart < 120) {
      dots.push({
        x1: conn.x1,
        y1: conn.y1,
        x2: conn.x2,
        y2: conn.y2,
        cycleStart: baseStart,
      });
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {props.showBackground && <BoardTexture seed="tree-bg" />}

        {/* Title */}
        {props.title && (
          <div
            style={{
              position: 'absolute',
              top: height * 0.08,
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: titleOpacity,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: BLACKBOARD_FONTS.heading,
                fontSize: s(48),
                fontWeight: 600,
                color: BLACKBOARD_COLORS.text,
                letterSpacing: '-0.025em',
              }}
            >
              {props.title}
            </span>
          </div>
        )}

        {/* SVG layer: lines + traveling dots */}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Growing lines */}
          {connections.map((conn, i) => (
            <GrowingLine
              key={`line-${i}`}
              x1={conn.x1}
              y1={conn.y1}
              x2={conn.x2}
              y2={conn.y2}
              frame={frame}
              animStart={conn.animStart}
              animDuration={conn.animDuration}
              strokeWidth={s(2)}
            />
          ))}

          {/* Traveling dots */}
          {dots.map((dot, i) => (
            <TravelingDot
              key={`dot-${i}`}
              x1={dot.x1}
              y1={dot.y1}
              x2={dot.x2}
              y2={dot.y2}
              frame={frame}
              cycleStart={dot.cycleStart}
              cycleDuration={20}
              dotRadius={s(4)}
            />
          ))}
        </svg>

        {/* Nodes layer */}
        {nodes.map((node, i) => (
          <TreeNode
            key={`node-${i}`}
            x={node.x}
            y={node.y}
            label={node.label}
            level={node.level}
            frame={frame}
            scaleStart={getNodeScaleStart(node, i)}
            s={s}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerTree;
