import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerMatrixProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS } from '../../blackboard/constants';
import { glowFadeIn, glowExit } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { useScale } from '../../use-scale';

const QUADRANT_TINTS = [
  'rgba(249,115,22,0.05)', // top-left: faint primary
  'rgba(59,130,246,0.05)', // top-right: faint secondary
  'transparent',           // bottom-left: no tint
  'transparent',           // bottom-right: no tint
];

const ExplainerMatrix: React.FC<ExplainerMatrixProps> = ({
  showBackground,
  title,
  xAxisLabel,
  yAxisLabel,
  xAxisLow,
  xAxisHigh,
  yAxisLow,
  yAxisHigh,
  quadrants = [],
  cursorX,
  cursorY,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const s = useScale();

  // ── Layout constants ────────────────────────────────────────────────────
  const gridSize = s(800);
  const halfGrid = gridSize / 2;
  const centerX = width / 2;
  const centerY = height * 0.495; // ~950 at 1920h
  const cellPad = s(20);
  const cellSize = s(380);

  // ── Title animation (0-10) ──────────────────────────────────────────────
  const titleAnim = glowFadeIn(frame, 0, 10);

  // ── Axis draw-in ────────────────────────────────────────────────────────
  // Vertical axis: frames 8-25, draws from center outward
  const vAxisProgress = interpolate(frame, [8, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  // Horizontal axis: frames 15-32
  const hAxisProgress = interpolate(frame, [15, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Axis label fade-in (28-42) ──────────────────────────────────────────
  const axisLabelOpacity = interpolate(frame, [28, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Quadrant cell animations ────────────────────────────────────────────
  const quadrantStarts = [35, 45, 55, 65];
  const quadrantDuration = 10;

  // ── Cursor dot (75-90 move, 85-130 pulse) ───────────────────────────────
  const cursorMoveProgress = interpolate(frame, [75, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const cursorOpacity = interpolate(frame, [75, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor target position within the grid (0,0 = top-left, 1,1 = bottom-right)
  const cursorTargetX = centerX - halfGrid + cursorX * gridSize;
  const cursorTargetY = centerY - halfGrid + cursorY * gridSize;
  const cursorCurrentX = centerX + (cursorTargetX - centerX) * cursorMoveProgress;
  const cursorCurrentY = centerY + (cursorTargetY - centerY) * cursorMoveProgress;

  // Pulse: scale 1 -> 1.2 -> 1, looping from frame 85-130
  const pulseActive = frame >= 85 && frame <= 130;
  const pulsePhase = pulseActive
    ? interpolate(((frame - 85) % 20) / 20, [0, 0.5, 1], [1, 1.2, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  // Expanding ring: grows and fades, repeating every 20 frames
  const ringActive = frame >= 85 && frame <= 130;
  const ringCycle = ringActive ? ((frame - 85) % 20) / 20 : 0;
  const ringRadius = interpolate(ringCycle, [0, 1], [s(10), s(40)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringOpacity = ringActive
    ? interpolate(ringCycle, [0, 0.3, 1], [0.6, 0.4, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // ── Exit fade (135-150) ─────────────────────────────────────────────────
  const exit = glowExit(frame, 135, 15);

  // ── Quadrant cell positions (top-left origin of each cell) ──────────────
  // Order: TL, TR, BL, BR
  const cellPositions = [
    { x: centerX - halfGrid, y: centerY - halfGrid },               // top-left
    { x: centerX + halfGrid - cellSize, y: centerY - halfGrid },    // top-right
    { x: centerX - halfGrid, y: centerY + halfGrid - cellSize },    // bottom-left
    { x: centerX + halfGrid - cellSize, y: centerY + halfGrid - cellSize }, // bottom-right
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {showBackground && <BoardTexture seed="matrix-bg" />}

        {/* ── Title ──────────────────────────────────────────────── */}
        {title && (
          <div
            style={{
              position: 'absolute',
              top: centerY - halfGrid - s(100),
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: titleAnim.contentProgress,
              transform: `scale(${titleAnim.scale})`,
            }}
          >
            <div
              style={{
                fontFamily: BLACKBOARD_FONTS.heading,
                fontSize: s(44),
                fontWeight: 600,
                color: BLACKBOARD_COLORS.text,
                lineHeight: 1.15,
                letterSpacing: '-0.025em',
              }}
            >
              {title}
            </div>
          </div>
        )}

        {/* ── SVG layer: axes, cursor, ring ──────────────────────── */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {/* Vertical axis — two lines from center outward */}
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - halfGrid}
            stroke={BLACKBOARD_COLORS.surfaceBorder}
            strokeWidth={s(2)}
            strokeDasharray={halfGrid}
            strokeDashoffset={halfGrid * (1 - vAxisProgress)}
          />
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY + halfGrid}
            stroke={BLACKBOARD_COLORS.surfaceBorder}
            strokeWidth={s(2)}
            strokeDasharray={halfGrid}
            strokeDashoffset={halfGrid * (1 - vAxisProgress)}
          />

          {/* Horizontal axis — two lines from center outward */}
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX - halfGrid}
            y2={centerY}
            stroke={BLACKBOARD_COLORS.surfaceBorder}
            strokeWidth={s(2)}
            strokeDasharray={halfGrid}
            strokeDashoffset={halfGrid * (1 - hAxisProgress)}
          />
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX + halfGrid}
            y2={centerY}
            stroke={BLACKBOARD_COLORS.surfaceBorder}
            strokeWidth={s(2)}
            strokeDasharray={halfGrid}
            strokeDashoffset={halfGrid * (1 - hAxisProgress)}
          />

          {/* Cursor dot */}
          {cursorOpacity > 0 && (
            <>
              {/* Expanding ring */}
              {ringActive && (
                <circle
                  cx={cursorCurrentX}
                  cy={cursorCurrentY}
                  r={ringRadius}
                  fill="none"
                  stroke={BLACKBOARD_COLORS.primary}
                  strokeWidth={s(2)}
                  opacity={ringOpacity}
                />
              )}

              {/* Dot */}
              <circle
                cx={cursorCurrentX}
                cy={cursorCurrentY}
                r={s(10) * pulsePhase}
                fill={BLACKBOARD_COLORS.primary}
                opacity={cursorOpacity}
              />
            </>
          )}
        </svg>

        {/* ── Axis labels ────────────────────────────────────────── */}
        {/* Y-axis label (rotated, left side) */}
        <div
          style={{
            position: 'absolute',
            left: centerX - halfGrid - s(50),
            top: centerY,
            opacity: axisLabelOpacity,
            transform: 'rotate(-90deg)',
            transformOrigin: 'center center',
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(20),
            fontWeight: 500,
            color: BLACKBOARD_COLORS.textDim,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {yAxisLabel}
        </div>

        {/* X-axis label (bottom center) */}
        <div
          style={{
            position: 'absolute',
            left: centerX,
            top: centerY + halfGrid + s(40),
            transform: 'translateX(-50%)',
            opacity: axisLabelOpacity,
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(20),
            fontWeight: 500,
            color: BLACKBOARD_COLORS.textDim,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {xAxisLabel}
        </div>

        {/* Top label (yAxisHigh) */}
        <div
          style={{
            position: 'absolute',
            left: centerX,
            top: centerY - halfGrid - s(30),
            transform: 'translateX(-50%)',
            opacity: axisLabelOpacity,
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(18),
            color: BLACKBOARD_COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          {yAxisHigh}
        </div>

        {/* Bottom label (yAxisLow) */}
        <div
          style={{
            position: 'absolute',
            left: centerX,
            top: centerY + halfGrid + s(8),
            transform: 'translateX(-50%)',
            opacity: axisLabelOpacity,
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(18),
            color: BLACKBOARD_COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          {yAxisLow}
        </div>

        {/* Left label (xAxisLow) */}
        <div
          style={{
            position: 'absolute',
            left: centerX - halfGrid - s(8),
            top: centerY,
            transform: 'translate(-100%, -50%)',
            opacity: axisLabelOpacity,
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(18),
            color: BLACKBOARD_COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          {xAxisLow}
        </div>

        {/* Right label (xAxisHigh) */}
        <div
          style={{
            position: 'absolute',
            left: centerX + halfGrid + s(8),
            top: centerY,
            transform: 'translateY(-50%)',
            opacity: axisLabelOpacity,
            fontFamily: BLACKBOARD_FONTS.body,
            fontSize: s(18),
            color: BLACKBOARD_COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          {xAxisHigh}
        </div>

        {/* ── Quadrant cells ─────────────────────────────────────── */}
        {quadrants.map((quad, qi) => {
          const cellStart = quadrantStarts[qi];
          const cellOpacity = interpolate(frame, [cellStart, cellStart + quadrantDuration], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const cellScale = interpolate(frame, [cellStart, cellStart + quadrantDuration], [0.96, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });
          const pos = cellPositions[qi];

          return (
            <div
              key={qi}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: cellSize,
                height: cellSize,
                opacity: cellOpacity,
                transform: `scale(${cellScale})`,
                padding: cellPad,
                display: 'flex',
                flexDirection: 'column',
                gap: s(10),
                backgroundColor: QUADRANT_TINTS[qi],
                borderRadius: s(8),
              }}
            >
              {/* Quadrant label */}
              <div
                style={{
                  fontFamily: BLACKBOARD_FONTS.heading,
                  fontSize: s(20),
                  fontWeight: 600,
                  color: BLACKBOARD_COLORS.text,
                  lineHeight: 1.2,
                  marginBottom: s(4),
                }}
              >
                {quad.label}
              </div>

              {/* Items as pills */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: s(8),
                }}
              >
                {(quad.items ?? []).map((item, ii) => {
                  const pillDelay = ii * 3;
                  const pillOpacity = interpolate(
                    frame,
                    [cellStart + 4 + pillDelay, cellStart + 4 + pillDelay + 6],
                    [0, 1],
                    {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    },
                  );
                  const pillY = interpolate(
                    frame,
                    [cellStart + 4 + pillDelay, cellStart + 4 + pillDelay + 6],
                    [s(6), 0],
                    {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing: Easing.out(Easing.cubic),
                    },
                  );

                  return (
                    <div
                      key={ii}
                      style={{
                        opacity: pillOpacity,
                        transform: `translateY(${pillY}px)`,
                        backgroundColor: BLACKBOARD_COLORS.surfaceBorder,
                        borderRadius: s(6),
                        padding: `${s(6)}px ${s(12)}px`,
                        fontFamily: BLACKBOARD_FONTS.body,
                        fontSize: s(15),
                        color: BLACKBOARD_COLORS.textMuted,
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerMatrix;
