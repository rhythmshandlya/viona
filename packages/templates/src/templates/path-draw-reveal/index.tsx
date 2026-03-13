import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants } from './constants';
import type { PathDrawRevealProps } from './schema';

const PathDrawReveal: React.FC<PathDrawRevealProps> = (props) => {
  const { COLORS, FONTS, BACKGROUNDS: BG_THEME } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const s = useScale();

  const stepCount = props.steps.length;

  // --- Title entrance (spring at top 12%) ---
  const titleSpring = spring({ frame, fps, config: { damping: 26, stiffness: 120, mass: 1.0 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleSlideY = interpolate(titleSpring, [0, 1], [s(20), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- SVG path dimensions ---
  const pathMarginX = width * 0.1;
  const pathY = height * 0.5;
  const pathWidth = width - pathMarginX * 2;
  const totalPathLength = pathWidth;

  // --- Path draw animation (frames 20-70) ---
  const drawProgress = interpolate(frame, [20, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const dashOffset = totalPathLength * (1 - drawProgress);

  // --- Node positions ---
  const nodePositions = props.steps.map((_, i) => ({
    x: pathMarginX + (pathWidth / (stepCount - 1 || 1)) * i,
    y: pathY,
  }));

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
          top: `${height * 0.12}px`,
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

      {/* SVG path + nodes */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Horizontal connecting line */}
        <line
          x1={nodePositions[0]?.x ?? 0}
          y1={pathY}
          x2={nodePositions[nodePositions.length - 1]?.x ?? pathWidth}
          y2={pathY}
          stroke={COLORS.accent}
          strokeWidth={s(3)}
          strokeDasharray={totalPathLength}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.6}
        />

        {/* Nodes */}
        {nodePositions.map((pos, i) => {
          const nodeDelay = 40 + i * 15;
          const nodeSpring = spring({
            frame: frame - nodeDelay,
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

          // Label fade in (after node)
          const labelDelay = nodeDelay + 10;
          const labelOpacity = interpolate(frame, [labelDelay, labelDelay + 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const circleRadius = s(24);

          return (
            <g key={i}>
              {/* Glow */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={circleRadius * 1.6}
                fill={COLORS.accent}
                opacity={nodeOpacity * 0.15}
                style={{ transform: `scale(${nodeScale})`, transformOrigin: `${pos.x}px ${pos.y}px` }}
              />
              {/* Circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={circleRadius}
                fill={BG_THEME.bg}
                stroke={COLORS.accent}
                strokeWidth={s(3)}
                opacity={nodeOpacity}
                style={{ transform: `scale(${nodeScale})`, transformOrigin: `${pos.x}px ${pos.y}px` }}
              />
              {/* Number */}
              <text
                x={pos.x}
                y={pos.y}
                dy={s(6)}
                textAnchor="middle"
                fill={COLORS.accent}
                fontFamily={FONTS.headline}
                fontSize={s(18)}
                fontWeight={700}
                opacity={nodeOpacity}
                style={{ transform: `scale(${nodeScale})`, transformOrigin: `${pos.x}px ${pos.y}px` }}
              >
                {i + 1}
              </text>
              {/* Label */}
              <text
                x={pos.x}
                y={pos.y + circleRadius + s(28)}
                textAnchor="middle"
                fill={BG_THEME.text}
                fontFamily={FONTS.body}
                fontSize={s(16)}
                fontWeight={500}
                opacity={labelOpacity}
              >
                {props.steps[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default PathDrawReveal;
