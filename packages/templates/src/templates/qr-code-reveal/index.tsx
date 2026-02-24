import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { getConstants, BACKGROUNDS, QR_GRID_SIZE, QR_CELL_SIZE, QR_GAP } from './constants';
import { useScale } from '../../use-scale';
import type { QrCodeRevealProps } from './schema';

// ── Seeded pseudo-random number generator ──────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Fisher-Yates shuffle with seeded RNG ───────────────────────────
function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Position marker (the 3 big squares in QR corners) ──────────────
function isPositionMarker(row: number, col: number, gridSize: number): boolean {
  const markerSize = 7;
  // Top-left
  if (row < markerSize && col < markerSize) return true;
  // Top-right
  if (row < markerSize && col >= gridSize - markerSize) return true;
  // Bottom-left
  if (row >= gridSize - markerSize && col < markerSize) return true;
  return false;
}

// ── Get the fill state for position marker cells ───────────────────
function getPositionMarkerFill(
  localRow: number,
  localCol: number,
): boolean {
  // Outer border ring
  if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) return true;
  // White ring
  if (localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5) return false;
  // Inner 3x3 square
  return true;
}

// ── Check if cell is in a position marker and get its fill ─────────
function positionMarkerCell(
  row: number,
  col: number,
  gridSize: number,
): { inMarker: boolean; filled: boolean } {
  const markerSize = 7;

  // Top-left
  if (row < markerSize && col < markerSize) {
    return { inMarker: true, filled: getPositionMarkerFill(row, col) };
  }
  // Top-right
  if (row < markerSize && col >= gridSize - markerSize) {
    return {
      inMarker: true,
      filled: getPositionMarkerFill(row, col - (gridSize - markerSize)),
    };
  }
  // Bottom-left
  if (row >= gridSize - markerSize && col < markerSize) {
    return {
      inMarker: true,
      filled: getPositionMarkerFill(row - (gridSize - markerSize), col),
    };
  }

  return { inMarker: false, filled: false };
}

// ── Generate timing pattern (alternating row/col lines) ────────────
function isTimingPattern(row: number, col: number, gridSize: number): boolean {
  const markerSize = 7;
  // Horizontal timing pattern (row 6, between markers)
  if (row === 6 && col >= markerSize && col < gridSize - markerSize) {
    return col % 2 === 0;
  }
  // Vertical timing pattern (col 6, between markers)
  if (col === 6 && row >= markerSize && row < gridSize - markerSize) {
    return row % 2 === 0;
  }
  return false;
}

// ── Alignment pattern (small square, for larger QR codes) ──────────
function isAlignmentPattern(row: number, col: number, gridSize: number): boolean {
  if (gridSize < 25) return false;
  const center = gridSize - 7 - 2; // Roughly position for version 2+
  const dr = Math.abs(row - center);
  const dc = Math.abs(col - center);
  if (dr <= 2 && dc <= 2) {
    // 5x5 alignment pattern: outer ring filled, middle ring empty, center filled
    if (dr === 2 || dc === 2) return true;
    if (dr === 1 || dc === 1) return false;
    return true; // Center
  }
  return false;
}

// ── Generate the full QR grid pattern ──────────────────────────────
function generateQrGrid(
  gridSize: number,
  seed: number,
): { filled: boolean; row: number; col: number }[] {
  const rand = seededRandom(seed);
  const cells: { filled: boolean; row: number; col: number }[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const marker = positionMarkerCell(row, col, gridSize);

      if (marker.inMarker) {
        cells.push({ filled: marker.filled, row, col });
        continue;
      }

      if (isTimingPattern(row, col, gridSize)) {
        cells.push({ filled: true, row, col });
        continue;
      }

      if (isAlignmentPattern(row, col, gridSize)) {
        cells.push({ filled: true, row, col });
        continue;
      }

      // Separator zones around position markers should stay empty
      const markerSize = 7;
      const inSeparator =
        (row < markerSize + 1 && col < markerSize + 1) ||
        (row < markerSize + 1 && col >= gridSize - markerSize - 1) ||
        (row >= gridSize - markerSize - 1 && col < markerSize + 1);

      if (inSeparator && !isPositionMarker(row, col, gridSize)) {
        cells.push({ filled: false, row, col });
        continue;
      }

      // Data region: pseudo-random fill (~45% density for visual appeal)
      const filled = rand() < 0.45;
      cells.push({ filled, row, col });
    }
  }

  return cells;
}

// ── Generate reveal order (center outward with randomization) ──────
function generateRevealOrder(
  gridSize: number,
  seed: number,
): number[] {
  const rand = seededRandom(seed + 1000);
  const center = (gridSize - 1) / 2;
  const indices: { index: number; dist: number }[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const dx = col - center;
      const dy = row - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Add some randomness to the distance for organic feel
      const jitter = rand() * 3;
      indices.push({ index: row * gridSize + col, dist: dist + jitter });
    }
  }

  indices.sort((a, b) => a.dist - b.dist);
  return indices.map((i) => i.index);
}

// ── DotGrid SVG background ─────────────────────────────────────────
const DotGrid: React.FC<{ color: string }> = ({ color }) => {
  const s = useScale();
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="qr-dot-grid" width={s(32)} height={s(32)} patternUnits="userSpaceOnUse">
          <circle cx={s(16)} cy={s(16)} r={s(1)} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#qr-dot-grid)" />
    </svg>
  );
};

// ── QR Frame border component ──────────────────────────────────────
const QrFrame: React.FC<{
  size: number;
  borderColor: string;
  bgColor: string;
  opacity: number;
  scale: number;
  accentColor: string;
}> = ({ size, borderColor, bgColor, opacity, scale, accentColor }) => {
  const s = useScale();
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid ${borderColor}`,
        borderRadius: s(16),
        backgroundColor: bgColor,
        opacity,
        transform: `scale(${scale})`,
        position: 'absolute',
        boxShadow: `0 0 ${s(60)}px ${accentColor}22, 0 ${s(4)}px ${s(30)}px rgba(0,0,0,0.3)`,
      }}
    />
  );
};

// ── Main component ─────────────────────────────────────────────────
const QrCodeReveal: React.FC<QrCodeRevealProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const gridSize = QR_GRID_SIZE;
  const cellSize = s(QR_CELL_SIZE);
  const gap = s(QR_GAP);
  const totalGridPx = gridSize * (cellSize + gap) - gap;
  const framePadding = s(40);
  const frameSize = totalGridPx + framePadding * 2;

  // Pre-compute grid and reveal order
  const grid = React.useMemo(() => generateQrGrid(gridSize, props.seed), [props.seed]);
  const revealOrder = React.useMemo(
    () => generateRevealOrder(gridSize, props.seed),
    [props.seed],
  );

  // Only filled cells participate in animation
  const filledIndices = React.useMemo(
    () => revealOrder.filter((idx) => grid[idx].filled),
    [grid, revealOrder],
  );

  // ── Animation timeline ──────────────────────────────────────────
  // 0-15: Background fade in
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // 15-25: QR frame appears
  const frameOpacity = interpolate(frame, [15, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const frameScale = interpolate(frame, [15, 25], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.back(1.5)),
  });

  // 25-120: QR cells fill in progressively
  const cellRevealProgress = interpolate(frame, [25, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 120-140: Label text fades in
  const labelOpacity = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelSlideY = interpolate(frame, [120, 140], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 140-160: URL text fades in
  const urlOpacity = interpolate(frame, [140, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlSlideY = interpolate(frame, [140, 160], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // 310-340: QR fades out
  const qrFadeOut = interpolate(frame, [310, 340], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 330-360: Full fade out
  const globalFadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Number of filled cells currently revealed
  const revealedCount = Math.floor(cellRevealProgress * filledIndices.length);

  // Build a set of revealed cell indices for fast lookup
  const revealedSet = React.useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < revealedCount; i++) {
      set.add(filledIndices[i]);
    }
    return set;
  }, [revealedCount, filledIndices]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        opacity: bgOpacity * globalFadeOut,
        overflow: 'hidden',
      }}
    >
      {/* DotGrid background */}
      <DotGrid color={theme.gridColor} />

      {/* Centered content container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(32),
        }}
      >
        {/* QR code area */}
        <div
          style={{
            position: 'relative',
            width: frameSize,
            height: frameSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: qrFadeOut,
          }}
        >
          {/* Frame / border */}
          <QrFrame
            size={frameSize}
            borderColor={theme.frameBorder}
            bgColor={theme.frameBg}
            opacity={frameOpacity}
            scale={frameScale}
            accentColor={props.accentColor}
          />

          {/* QR grid cells */}
          <div
            style={{
              position: 'relative',
              width: totalGridPx,
              height: totalGridPx,
              zIndex: 1,
            }}
          >
            {grid.map((cell, idx) => {
              if (!cell.filled) return null;

              const isRevealed = revealedSet.has(idx);
              if (!isRevealed) return null;

              // Find this cell's position in the reveal order for stagger
              const revealIndex = filledIndices.indexOf(idx);
              const totalCells = filledIndices.length;
              const cellNorm = revealIndex / totalCells;

              // Per-cell staggered entrance
              const cellEnterFrame = 25 + cellNorm * 95;
              const cellOpacity = interpolate(
                frame,
                [cellEnterFrame, cellEnterFrame + 4],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              const cellScale = interpolate(
                frame,
                [cellEnterFrame, cellEnterFrame + 6],
                [0, 1],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.back(2)),
                },
              );

              const x = cell.col * (cellSize + gap);
              const y = cell.row * (cellSize + gap);

              // Position marker cells get the accent color
              const marker = positionMarkerCell(cell.row, cell.col, gridSize);
              const isMarkerCell = marker.inMarker;
              const fillColor = isMarkerCell ? props.accentColor : theme.cellOn;

              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: fillColor,
                    borderRadius: s(2),
                    opacity: cellOpacity,
                    transform: `scale(${cellScale})`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Label text */}
        <span
          style={{
            fontFamily: FONTS.headline,
            fontSize: s(36),
            fontWeight: 700,
            color: theme.text,
            letterSpacing: s(4),
            textTransform: 'uppercase',
            opacity: labelOpacity * qrFadeOut,
            transform: `translateY(${labelSlideY}px)`,
          }}
        >
          {props.label}
        </span>

        {/* URL text */}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(26),
            fontWeight: 400,
            color: props.accentColor,
            letterSpacing: 1,
            opacity: urlOpacity * qrFadeOut,
            transform: `translateY(${urlSlideY}px)`,
          }}
        >
          {props.url}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default QrCodeReveal;
