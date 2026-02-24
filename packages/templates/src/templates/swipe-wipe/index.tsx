import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { SwipeWipeProps } from './schema';

/* ── DotGrid SVG Background ─────────────────────────────────────── */

const DotGrid: React.FC<{ color: string; opacity: number; gridWidth: number; gridHeight: number }> = ({
  color,
  opacity,
  gridWidth,
  gridHeight,
}) => {
  const s = useScale();
  const spacing = s(30);
  const radius = s(1.5);
  const cols = Math.ceil(gridWidth / spacing) + 1;
  const rows = Math.ceil(gridHeight / spacing) + 1;

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * spacing}
          cy={r * spacing}
          r={radius}
          fill={color}
        />
      );
    }
  }

  return (
    <svg
      width={gridWidth}
      height={gridHeight}
      viewBox={`0 0 ${gridWidth} ${gridHeight}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        opacity,
      }}
    >
      {dots}
    </svg>
  );
};

/* ── Circle Expand Wipe ──────────────────────────────────────────── */

const CircleExpandWipe: React.FC<{
  progress: number;
  color: string;
  canvasWidth: number;
  canvasHeight: number;
}> = ({ progress, color, canvasWidth, canvasHeight }) => {
  // Max radius to cover entire canvas from center
  const maxRadius = Math.sqrt((canvasWidth / 2) ** 2 + (canvasHeight / 2) ** 2);
  const currentRadius = progress * maxRadius;

  return (
    <div
      style={{
        position: 'absolute',
        top: canvasHeight / 2 - currentRadius,
        left: canvasWidth / 2 - currentRadius,
        width: currentRadius * 2,
        height: currentRadius * 2,
        borderRadius: '50%',
        backgroundColor: color,
      }}
    />
  );
};

/* ── Diagonal Wipe ───────────────────────────────────────────────── */

const DiagonalWipe: React.FC<{
  progress: number;
  color: string;
}> = ({ progress, color }) => {
  // progress 0 → shape fully off-screen left; 1 → fully covers screen; 2 → fully off-screen right
  // We use a parallelogram that sweeps from bottom-left to top-right
  const offset = interpolate(progress, [0, 1], [-120, 120]);

  const clipPath = `polygon(${offset}% 0%, ${offset + 60}% 0%, ${offset - 20}% 100%, ${offset - 80}% 100%)`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: color,
        clipPath,
      }}
    />
  );
};

/* ── Horizontal Wipe ─────────────────────────────────────────────── */

const HorizontalWipe: React.FC<{
  progress: number;
  color: string;
}> = ({ progress, color }) => {
  // progress 0 → bar offscreen left; 1 → covering screen; 2 → offscreen right
  const translateX = interpolate(progress, [0, 1], [-110, 110]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: color,
        transform: `translateX(${translateX}%)`,
      }}
    />
  );
};

/* ── Main Component ──────────────────────────────────────────────── */

const SwipeWipe: React.FC<SwipeWipeProps> = (props) => {
  const { COLORS, FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const s = useScale();
  const palette = BACKGROUNDS[props.background];

  // ── Phase: Background fade in (0-15) ─────────────────────────
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Phase: Shape wipe across (60-180) ────────────────────────
  // For circleExpand: 0→1 expand, then 1→0 shrink
  // For diagonal/horizontal: 0→1 sweep on, then 1→2 sweep off
  let wipeProgress: number;

  if (props.style === 'circleExpand') {
    // Expand from 0 to full coverage (60-120)
    const expandProgress = interpolate(frame, [60, 120], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });

    // Shrink back from full coverage to 0 (120-180)
    const shrinkProgress = interpolate(frame, [120, 180], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });

    // Use expand progress until peak, then shrink progress after
    wipeProgress = frame <= 120 ? expandProgress : shrinkProgress;
  } else {
    // For diagonal and horizontal wipes: sweep on (0→1), then sweep off (1→2)
    const sweepOn = interpolate(frame, [60, 120], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });

    const sweepOff = interpolate(frame, [120, 180], [1, 2], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });

    wipeProgress = frame <= 120 ? sweepOn : sweepOff;
  }

  // ── Phase: Text appears during peak coverage (100-130) ───────
  const textOpacity = interpolate(frame, [100, 110, 125, 135], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textScale = interpolate(frame, [100, 115], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // ── Phase: Final fade out (330-360) ──────────────────────────
  const finalFade = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames - 1],
    [1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Whether the wipe shape is visible at all
  const wipeVisible = frame >= 60 && frame <= 180;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bg,
        opacity: bgOpacity * finalFade,
        overflow: 'hidden',
      }}
    >
      {/* Dot grid background */}
      <DotGrid color={palette.dotColor} opacity={bgOpacity} gridWidth={width} gridHeight={height} />

      {/* Wipe shape */}
      {wipeVisible && (
        <>
          {props.style === 'circleExpand' && (
            <CircleExpandWipe
              progress={wipeProgress}
              color={props.accentColor}
              canvasWidth={width}
              canvasHeight={height}
            />
          )}
          {props.style === 'diagonalWipe' && (
            <DiagonalWipe
              progress={wipeProgress}
              color={props.accentColor}
            />
          )}
          {props.style === 'horizontalWipe' && (
            <HorizontalWipe
              progress={wipeProgress}
              color={props.accentColor}
            />
          )}
        </>
      )}

      {/* Text overlay during peak coverage */}
      {props.text && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: textOpacity,
            transform: `scale(${textScale})`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: FONTS.headline,
              fontSize: s(80),
              fontWeight: 900,
              color: '#FFFFFF',
              textAlign: 'center',
              padding: `0 ${s(80)}px`,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
            }}
          >
            {props.text}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export default SwipeWipe;
