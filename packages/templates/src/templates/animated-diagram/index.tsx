import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { AnimatedDiagramProps } from './schema';

const AnimatedDiagram: React.FC<AnimatedDiagramProps> = (props) => {
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  // --- Content area ---
  const contentTop = height * 0.25;
  const contentHeight = height * 0.5;
  const contentLeft = width * 0.08;
  const contentWidth = width * 0.84;

  // --- Title entrance ---
  const titleSpring = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleSlideY = interpolate(titleSpring, [0, 1], [s(20), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Node positions (normalized 0-1 mapped to content area) ---
  const resolvedNodes = props.nodes.map((node) => ({
    label: node.label,
    px: contentLeft + node.x * contentWidth,
    py: contentTop + node.y * contentHeight,
  }));

  // --- Node stagger (12-frame apart) ---
  const nodeStaggerBase = 15;
  const nodeStagger = 12;

  // --- Compute when all nodes are in ---
  const lastNodeDelay = nodeStaggerBase + (props.nodes.length - 1) * nodeStagger;
  const edgesStartFrame = lastNodeDelay + 20; // after nodes settle

  // --- Node dimensions ---
  const nodeW = s(140);
  const nodeH = s(56);
  const nodeRadius = 16;

  // --- Outro fade ---
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_THEME.bg, opacity: outroOpacity, overflow: 'hidden' }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: `${height * 0.10}px`,
          width: '100%',
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleSlideY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(36),
            fontWeight: 700,
            letterSpacing: s(4),
            color: BG_THEME.text,
            textTransform: 'uppercase',
          }}
        >
          {props.title}
        </span>
      </div>

      {/* Edges (SVG lines drawn between nodes) */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {props.edges.map((edge, i) => {
          const fromNode = resolvedNodes[edge.from];
          const toNode = resolvedNodes[edge.to];
          if (!fromNode || !toNode) return null;

          const edgeDelay = edgesStartFrame + i * 10;
          const dx = toNode.px - fromNode.px;
          const dy = toNode.py - fromNode.py;
          const lineLength = Math.sqrt(dx * dx + dy * dy);

          const edgeProgress = interpolate(frame, [edgeDelay, edgeDelay + 25], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const edgeDashOffset = lineLength * (1 - edgeProgress);

          return (
            <line
              key={`edge-${i}`}
              x1={fromNode.px}
              y1={fromNode.py}
              x2={toNode.px}
              y2={toNode.py}
              stroke={BG_THEME.lineColor}
              strokeWidth={s(2)}
              strokeDasharray={lineLength}
              strokeDashoffset={edgeDashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {resolvedNodes.map((node, i) => {
        const delay = nodeStaggerBase + i * nodeStagger;
        const nodeSpring = spring({
          frame: frame - delay,
          fps,
          config: { damping: 22, stiffness: 170, mass: 0.8 },
        });
        const nodeScale = interpolate(nodeSpring, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const nodeOpacity = interpolate(nodeSpring, [0, 1], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: node.px - nodeW / 2,
              top: node.py - nodeH / 2,
              width: nodeW,
              height: nodeH,
              borderRadius: nodeRadius,
              backgroundColor: BG_THEME.nodeBg,
              border: `${s(2)}px solid ${COLORS.accent}`,
              boxShadow: `0 0 ${s(20)}px ${COLORS.accent}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: nodeOpacity,
              transform: `scale(${nodeScale})`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: s(16),
                fontWeight: 600,
                color: BG_THEME.text,
                textAlign: 'center',
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default AnimatedDiagram;
