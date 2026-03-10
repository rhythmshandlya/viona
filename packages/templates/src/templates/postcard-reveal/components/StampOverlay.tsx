import React from 'react';

interface StampOverlayProps {
  x: number;
  y: number;
  stampColor: string;
  opacity: number;
  scale: number;
}

/**
 * Faux postage stamp with perforated/wavy edges and airplane icon.
 * Rendered as SVG for crisp edges.
 */
const StampOverlay: React.FC<StampOverlayProps> = ({
  x,
  y,
  stampColor,
  opacity,
  scale,
}) => {
  const stampWidth = 100;
  const stampHeight = 120;
  const perfRadius = 4;
  const perfSpacing = 12;

  // Generate perforated edge path
  const generatePerfEdge = (): string => {
    const parts: string[] = [];
    const inset = 6;
    const innerW = stampWidth - inset * 2;
    const innerH = stampHeight - inset * 2;

    // Start top-left
    parts.push(`M ${inset} ${inset}`);

    // Top edge - zigzag
    for (let px = inset; px < innerW + inset; px += perfSpacing) {
      const mid = px + perfSpacing / 2;
      const end = Math.min(px + perfSpacing, innerW + inset);
      parts.push(`Q ${mid} ${inset - perfRadius} ${end} ${inset}`);
    }

    // Right edge - zigzag
    for (let py = inset; py < innerH + inset; py += perfSpacing) {
      const mid = py + perfSpacing / 2;
      const end = Math.min(py + perfSpacing, innerH + inset);
      parts.push(`Q ${innerW + inset + perfRadius} ${mid} ${innerW + inset} ${end}`);
    }

    // Bottom edge - zigzag (right to left)
    for (let px = innerW + inset; px > inset; px -= perfSpacing) {
      const mid = px - perfSpacing / 2;
      const end = Math.max(px - perfSpacing, inset);
      parts.push(`Q ${mid} ${innerH + inset + perfRadius} ${end} ${innerH + inset}`);
    }

    // Left edge - zigzag (bottom to top)
    for (let py = innerH + inset; py > inset; py -= perfSpacing) {
      const mid = py - perfSpacing / 2;
      const end = Math.max(py - perfSpacing, inset);
      parts.push(`Q ${inset - perfRadius} ${mid} ${inset} ${end}`);
    }

    parts.push('Z');
    return parts.join(' ');
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: stampWidth,
        height: stampHeight,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}
    >
      <svg
        width={stampWidth}
        height={stampHeight}
        viewBox={`0 0 ${stampWidth} ${stampHeight}`}
      >
        {/* White background for full stamp area */}
        <rect
          x={0}
          y={0}
          width={stampWidth}
          height={stampHeight}
          fill="white"
          rx={2}
        />

        {/* Colored perforated inner area */}
        <path
          d={generatePerfEdge()}
          fill={stampColor}
        />

        {/* Airplane icon */}
        <g transform="translate(50, 55) scale(1.4)" fill="white">
          <path d="M -12 4 L -4 0 L -12 -4 L -10 0 Z" />
          <path d="M -4 0 L 12 -10 L 14 -8 L 2 0 L 14 8 L 12 10 Z" />
          <line
            x1={-8}
            y1={6}
            x2={-2}
            y2={3}
            stroke="white"
            strokeWidth={1.2}
          />
        </g>

        {/* Value text at bottom */}
        <text
          x={stampWidth / 2}
          y={stampHeight - 16}
          textAnchor="middle"
          fontSize={10}
          fill="white"
          fontFamily="serif"
          fontWeight={700}
          letterSpacing={1}
        >
          AIR MAIL
        </text>
      </svg>
    </div>
  );
};

export default StampOverlay;
