import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

interface DataPoint {
  x: number;
  y: number;
}

interface LineGraphProps {
  /** Array of data points with x and y values */
  data: DataPoint[];
  /** Frame to start drawing */
  startFrame: number;
  /** Duration to draw complete line */
  durationFrames: number;
  /** Line color */
  color?: string;
  /** Show data point dots (default: true) */
  showDots?: boolean;
  /** Fill area under line (default: false) */
  fillArea?: boolean;
  /** Stroke width multiplier (default: 1) */
  strokeWidth?: number;
  /** Dot size multiplier (default: 1) */
  dotSize?: number;
  /** Show grid lines (default: false) */
  showGrid?: boolean;
  /** Grid color */
  gridColor?: string;
  /** Padding percentage (default: 10) */
  padding?: number;
}

/**
 * LineGraph - Animated line graph that draws progressively
 *
 * Use for: time series, trends, continuous data, progress over time
 *
 * @example
 * <LineGraph
 *   data={[
 *     { x: 0, y: 10 },
 *     { x: 1, y: 25 },
 *     { x: 2, y: 20 },
 *     { x: 3, y: 45 },
 *     { x: 4, y: 40 },
 *   ]}
 *   startFrame={0}
 *   durationFrames={120}
 *   color="#8b5cf6"
 *   fillArea
 * />
 */
export const LineGraph: React.FC<LineGraphProps> = ({
  data,
  startFrame,
  durationFrames,
  color = '#8b5cf6',
  showDots = true,
  fillArea = false,
  strokeWidth = 1,
  dotSize = 1,
  showGrid = false,
  gridColor = 'rgba(255, 255, 255, 0.1)',
  padding = 10,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const minDim = Math.min(width, height);

  if (data.length < 2) {
    return null;
  }

  // Calculate progress
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Calculate bounds
  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  // Add some padding to the data range
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const yPadding = yRange * 0.1;

  // Chart dimensions
  const chartPadding = (padding / 100) * minDim;
  const chartWidth = width - chartPadding * 2;
  const chartHeight = height - chartPadding * 2;

  // Scale functions
  const scaleX = (x: number) =>
    chartPadding + ((x - minX) / xRange) * chartWidth;
  const scaleY = (y: number) =>
    chartPadding + chartHeight - ((y - (minY - yPadding)) / (yRange + yPadding * 2)) * chartHeight;

  // Generate path
  const points = data.map((d) => ({ x: scaleX(d.x), y: scaleY(d.y) }));

  // Create SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  // Calculate total path length for animation
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  const visibleLength = totalLength * progress;

  // Area fill path
  const areaPath = fillArea
    ? `${pathD} L ${points[points.length - 1].x} ${chartPadding + chartHeight} L ${points[0].x} ${chartPadding + chartHeight} Z`
    : '';

  const actualStrokeWidth = minDim * 0.005 * strokeWidth;
  const actualDotSize = minDim * 0.015 * dotSize;

  return (
    <svg width={width} height={height}>
      {/* Grid */}
      {showGrid && (
        <g>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <React.Fragment key={ratio}>
              <line
                x1={chartPadding}
                y1={chartPadding + chartHeight * ratio}
                x2={chartPadding + chartWidth}
                y2={chartPadding + chartHeight * ratio}
                stroke={gridColor}
                strokeWidth={1}
              />
              <line
                x1={chartPadding + chartWidth * ratio}
                y1={chartPadding}
                x2={chartPadding + chartWidth * ratio}
                y2={chartPadding + chartHeight}
                stroke={gridColor}
                strokeWidth={1}
              />
            </React.Fragment>
          ))}
        </g>
      )}

      {/* Area fill */}
      {fillArea && (
        <path
          d={areaPath}
          fill={`${color}20`}
          clipPath="url(#lineClip)"
        />
      )}

      {/* Clip path for progressive reveal */}
      <defs>
        <clipPath id="lineClip">
          <rect
            x={0}
            y={0}
            width={chartPadding + chartWidth * progress}
            height={height}
          />
        </clipPath>
      </defs>

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={actualStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLength}
        strokeDashoffset={totalLength - visibleLength}
        style={{
          filter: `drop-shadow(0 0 ${actualStrokeWidth * 2}px ${color}80)`,
        }}
      />

      {/* Dots */}
      {showDots &&
        points.map((point, index) => {
          // Calculate when this point should appear
          let distanceToPoint = 0;
          for (let i = 1; i <= index; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            distanceToPoint += Math.sqrt(dx * dx + dy * dy);
          }

          const pointProgress = distanceToPoint / totalLength;
          const isVisible = progress >= pointProgress;
          const dotOpacity = isVisible
            ? interpolate(
                progress,
                [pointProgress, Math.min(1, pointProgress + 0.1)],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            : 0;

          return (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={actualDotSize}
              fill={color}
              opacity={dotOpacity}
              style={{
                filter: `drop-shadow(0 0 ${actualDotSize}px ${color})`,
              }}
            />
          );
        })}
    </svg>
  );
};

export default LineGraph;
