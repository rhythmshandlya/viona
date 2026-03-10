import React from 'react';
import type { ElevationPoint } from '../schema';

interface ElevationChartProps {
  data: ElevationPoint[];
  unit: 'meters' | 'feet';
  lineColor: string;
  drawProgress: number;
  chartWidth: number;
  chartHeight: number;
  bodyFont: string;
  textColor: string;
}

const PADDING = { top: 20, right: 40, bottom: 50, left: 80 };

function getGridIntervals(
  minAlt: number,
  maxAlt: number,
  unit: 'meters' | 'feet'
): number[] {
  const step = unit === 'meters' ? 500 : 1000;
  const lines: number[] = [];
  const start = Math.ceil(minAlt / step) * step;
  for (let v = start; v <= maxAlt; v += step) {
    lines.push(v);
  }
  return lines;
}

/**
 * Builds a smooth SVG path using Catmull-Rom to cubic Bezier conversion.
 * Returns both the line path and a closed area path (for gradient fill).
 */
function buildPaths(
  data: ElevationPoint[],
  plotW: number,
  plotH: number,
  minDist: number,
  maxDist: number,
  minAlt: number,
  maxAlt: number
): { linePath: string; areaPath: string } {
  if (data.length < 2) return { linePath: '', areaPath: '' };

  const distRange = maxDist - minDist || 1;
  const altRange = maxAlt - minAlt || 1;

  const pts = data.map((p) => ({
    x: PADDING.left + ((p.distance - minDist) / distRange) * plotW,
    y: PADDING.top + (1 - (p.altitude - minAlt) / altRange) * plotH,
  }));

  // Build cubic bezier segments from Catmull-Rom spline
  const tension = 0.3;
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const baselineY = PADDING.top + plotH;
  const areaPath =
    d +
    ` L ${pts[pts.length - 1].x} ${baselineY}` +
    ` L ${pts[0].x} ${baselineY} Z`;

  return { linePath: d, areaPath };
}

const ElevationChart: React.FC<ElevationChartProps> = ({
  data,
  unit,
  lineColor,
  drawProgress,
  chartWidth,
  chartHeight,
  bodyFont,
  textColor,
}) => {
  if (data.length < 2) return null;

  const plotW = chartWidth - PADDING.left - PADDING.right;
  const plotH = chartHeight - PADDING.top - PADDING.bottom;

  const minDist = data[0].distance;
  const maxDist = data[data.length - 1].distance;
  const allAltitudes = data.map((p) => p.altitude);
  const rawMinAlt = Math.min(...allAltitudes);
  const rawMaxAlt = Math.max(...allAltitudes);
  // Add 10% padding to altitude range
  const altPad = (rawMaxAlt - rawMinAlt) * 0.1;
  const minAlt = Math.max(0, rawMinAlt - altPad);
  const maxAlt = rawMaxAlt + altPad;

  const { linePath, areaPath } = buildPaths(
    data,
    plotW,
    plotH,
    minDist,
    maxDist,
    minAlt,
    maxAlt
  );

  const gridLines = getGridIntervals(minAlt, maxAlt, unit);
  const altRange = maxAlt - minAlt || 1;

  // Distance labels along X axis
  const distRange = maxDist - minDist || 1;
  const distStep = Math.ceil(distRange / 6);
  const distLabels: number[] = [];
  for (let d = 0; d <= maxDist; d += distStep) {
    distLabels.push(d);
  }

  const clipId = 'elev-clip-rect';
  const gradientId = 'elev-gradient';
  const clipWidth = (PADDING.left + plotW) * drawProgress;

  const unitLabel = unit === 'meters' ? 'm' : 'ft';
  const distUnit = 'km';

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      style={{ display: 'block' }}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.03} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={clipWidth} height={chartHeight} />
        </clipPath>
      </defs>

      {/* Horizontal grid lines */}
      {gridLines.map((alt) => {
        const y = PADDING.top + (1 - (alt - minAlt) / altRange) * plotH;
        if (y < PADDING.top || y > PADDING.top + plotH) return null;
        return (
          <React.Fragment key={alt}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={PADDING.left + plotW}
              y2={y}
              stroke={textColor}
              strokeOpacity={0.12}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 10}
              y={y + 4}
              textAnchor="end"
              fill={textColor}
              fillOpacity={0.6}
              fontSize={14}
              fontFamily={bodyFont}
            >
              {alt.toLocaleString()} {unitLabel}
            </text>
          </React.Fragment>
        );
      })}

      {/* Distance labels along bottom */}
      {distLabels.map((d) => {
        const x = PADDING.left + ((d - minDist) / distRange) * plotW;
        return (
          <text
            key={d}
            x={x}
            y={PADDING.top + plotH + 30}
            textAnchor="middle"
            fill={textColor}
            fillOpacity={0.6}
            fontSize={14}
            fontFamily={bodyFont}
          >
            {d} {distUnit}
          </text>
        );
      })}

      {/* Area fill with gradient, clipped by draw progress */}
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
        clipPath={`url(#${clipId})`}
      />

      {/* Line stroke, clipped by draw progress */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${clipId})`}
      />

      {/* Baseline */}
      <line
        x1={PADDING.left}
        y1={PADDING.top + plotH}
        x2={PADDING.left + plotW}
        y2={PADDING.top + plotH}
        stroke={textColor}
        strokeOpacity={0.2}
        strokeWidth={1}
      />

      {/* Y-axis line */}
      <line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={PADDING.top + plotH}
        stroke={textColor}
        strokeOpacity={0.2}
        strokeWidth={1}
      />
    </svg>
  );
};

export default ElevationChart;
